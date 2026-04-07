import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportNamedDeclaration, Program } from 'estree'

import {
  ArchitecturePolicyResolver,
  ProjectContext,
  getDeclarationNamesFromExport,
  normalizePath,
} from '../../utils/index.js'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow shared entrypoint symbols that are only used by one consumer group',
      recommended: false,
    },
    schema: [],
    messages: {
      notTrulyShared:
        'symbol "{{symbol}}" has {{consumerCount}} consumer group(s){{consumerGroup}} -> Must be used by 2+ entities',
    },
  },
  create(context) {
    const filename = context.filename
    if (!filename) return {}

    const resolver = ArchitecturePolicyResolver.fromContext(context)
    if (resolver === undefined) return {}

    const matched = resolver.matchFile(filename)
    if (matched === undefined || !matched.policy.shared) return {}
    if (!resolver.isPublicEntrypoint(filename)) return {}

    const sourceRoot = resolver.sourceRoot
    if (sourceRoot === undefined) return {}

    const projectRoot = resolver.deriveProjectRoot(filename)
    if (projectRoot === undefined) return {}

    const sourceDir = node_path.join(projectRoot, sourceRoot)
    const projectContext = ProjectContext.forFile(filename, {
      sourceRoot,
      projectRoot,
    })
    const analyzer = new NoFalseSharingAnalyzer(context, {
      entrypointFile: filename,
      sourceDir,
      projectContext,
    })

    return {
      Program(node) {
        analyzer.analyzeProgram(node)
      },
    }
  },
} satisfies Rule.RuleModule

class NoFalseSharingAnalyzer {
  constructor(
    private readonly context: Rule.RuleContext,
    private readonly options: SymbolAnalysisOptions,
  ) {
    this.scanner = new SymbolUsageScanner({
      entrypointFile: options.entrypointFile,
      projectContext: options.projectContext,
    })
  }

  private readonly scanner: SymbolUsageScanner

  analyzeProgram(node: Program): void {
    const exportedSymbols = collectExportedSymbols(node)
    if (exportedSymbols.length === 0) return

    const exportedSymbolSet = new Set(exportedSymbols)
    const consumerGroupsBySymbol = this.findConsumerGroupsBySymbol(
      exportedSymbols,
      exportedSymbolSet,
    )
    this.reportUnsharedSymbols(node, consumerGroupsBySymbol)
  }

  private findConsumerGroupsBySymbol(
    exportedSymbols: string[],
    exportedSymbolSet: Set<string>,
  ): Map<string, Set<string>> {
    const bySymbol = initializeConsumerGroupsBySymbol(exportedSymbols)
    const importers = this.scanner.scanSourceTree(this.options.sourceDir, exportedSymbolSet)
    for (const importer of importers) {
      const consumerGroup = getConsumerGroup(importer.filePath, this.options.sourceDir)
      for (const symbol of importer.symbols) {
        bySymbol.get(symbol)?.add(consumerGroup)
      }
    }
    return bySymbol
  }

  private reportUnsharedSymbols(
    node: Program,
    consumerGroupsBySymbol: Map<string, Set<string>>,
  ): void {
    for (const [symbol, groups] of consumerGroupsBySymbol) {
      if (groups.size >= MIN_CONSUMER_GROUPS) continue
      this.context.report({
        node,
        messageId: 'notTrulyShared',
        data: {
          symbol,
          consumerCount: String(groups.size),
          consumerGroup: getSingleConsumerGroup(groups),
        },
      })
    }
  }
}

const MIN_CONSUMER_GROUPS = 2

function collectExportedSymbols(program: Program): string[] {
  const symbols = new Set<string>()
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    addSymbolsFromExportNamed(statement, symbols)
  }
  return [...symbols]
}

function initializeConsumerGroupsBySymbol(exportedSymbols: string[]): Map<string, Set<string>> {
  const bySymbol = new Map<string, Set<string>>()
  for (const symbol of exportedSymbols) {
    bySymbol.set(symbol, new Set<string>())
  }
  return bySymbol
}

function addSymbolsFromExportNamed(node: ExportNamedDeclaration, symbols: Set<string>): void {
  for (const specifier of node.specifiers) {
    if (specifier.exported.type !== 'Identifier') continue
    symbols.add(specifier.exported.name)
  }
  if (node.declaration === null || node.declaration === undefined) return
  for (const name of getDeclarationNamesFromExport(node.declaration)) {
    symbols.add(name)
  }
}

function getConsumerGroup(importerPath: string, sourceDir: string): string {
  const rel = normalizePath(node_path.relative(sourceDir, importerPath))
  const parts = rel.split('/')
  if (parts.length <= 1) return rel
  return parts.slice(0, -1).join('/')
}

function getSingleConsumerGroup(groups: Set<string>): string {
  if (groups.size === 0) return ' (no consumers found)'
  if (groups.size !== 1) return ''
  const [single] = [...groups]
  return ` (group: ${single})`
}

class SymbolUsageScanner {
  constructor(private readonly options: ScannerOptions) {
    this.entrypointFile = normalizePath(options.entrypointFile)
  }

  private readonly entrypointFile: string

  scanSourceTree(sourceDir: string, exportedSymbols: Set<string>): SymbolImporter[] {
    const importers: SymbolImporter[] = []
    for (const filePath of this.options.projectContext.listSourceFiles(sourceDir)) {
      if (normalizePath(filePath) === this.entrypointFile) continue
      const symbols = this.getImportedSymbols(filePath, exportedSymbols)
      if (symbols.length === 0) continue
      importers.push({ filePath, symbols })
    }
    return importers
  }

  private getImportedSymbols(filePath: string, exportedSymbols: Set<string>): string[] {
    const result = new Set<string>()
    for (const declaration of this.options.projectContext.getImportDeclarations(filePath)) {
      this.addMatchingSymbols({
        symbolNames: declaration.getNamedImports().map((specifier) => specifier.getName()),
        specifier: declaration.getModuleSpecifierValue(),
        filePath,
        exportedSymbols,
        result,
      })
    }
    const sourceFile = this.options.projectContext.getSourceFile(filePath)
    if (sourceFile === undefined) return [...result]
    for (const declaration of sourceFile.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue()
      if (specifier === undefined || specifier.length === 0) continue
      this.addMatchingSymbols({
        symbolNames: declaration.getNamedExports().map((exported) => exported.getName()),
        specifier,
        filePath,
        exportedSymbols,
        result,
      })
    }
    return [...result]
  }

  private addMatchingSymbols(options: MatchingSymbolOptions): void {
    const resolvedTarget = this.options.projectContext.resolveLocalSpecifier(
      options.filePath,
      options.specifier,
    )
    if (!isSamePath(resolvedTarget, this.entrypointFile)) return
    for (const name of options.symbolNames) {
      if (name.length === 0) continue
      if (!options.exportedSymbols.has(name)) continue
      options.result.add(name)
    }
  }
}

function isSamePath(value: string | undefined, expected: string): boolean {
  if (value === undefined) return false
  return normalizePath(value) === normalizePath(expected)
}

interface MatchingSymbolOptions {
  symbolNames: readonly string[]
  specifier: string
  filePath: string
  exportedSymbols: Set<string>
  result: Set<string>
}

interface SymbolImporter {
  filePath: string
  symbols: string[]
}

interface SymbolAnalysisOptions {
  entrypointFile: string
  sourceDir: string
  projectContext: ProjectContext
}

interface ScannerOptions {
  entrypointFile: string
  projectContext: ProjectContext
}
