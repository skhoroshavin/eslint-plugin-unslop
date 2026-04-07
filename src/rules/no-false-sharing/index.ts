import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportNamedDeclaration, Program } from 'estree'

import {
  ArchitecturePolicyResolver,
  getDeclarationNamesFromExport,
  isPublicEntrypoint,
  normalizePath,
} from '../../utils/index.js'

import type { ProjectContext } from '../../utils/index.js'

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
    if (!isPublicEntrypoint(filename)) return {}

    const sourceRoot = resolver.sourceRoot
    if (sourceRoot === undefined) return {}

    const projectRoot = resolver.deriveProjectRoot(filename)
    if (projectRoot === undefined) return {}

    const sourceDir = node_path.join(projectRoot, sourceRoot)
    const projectContext = resolver.context

    return {
      Program(node) {
        analyzeProgram(context, node, { entrypointFile: filename, sourceDir, projectContext })
      },
    }
  },
} satisfies Rule.RuleModule

function analyzeProgram(context: Rule.RuleContext, node: Program, options: AnalysisOptions): void {
  const exportedSymbols = collectExportedSymbols(node)
  if (exportedSymbols.length === 0) return

  const exportedSymbolSet = new Set(exportedSymbols)
  const groupsBySymbol = findConsumerGroups(exportedSymbols, exportedSymbolSet, options)
  reportUnsharedSymbols(context, node, groupsBySymbol)
}

function findConsumerGroups(
  exportedSymbols: string[],
  exportedSymbolSet: Set<string>,
  options: AnalysisOptions,
): Map<string, Set<string>> {
  const bySymbol = new Map<string, Set<string>>()
  for (const symbol of exportedSymbols) {
    bySymbol.set(symbol, new Set<string>())
  }

  const entrypointFile = normalizePath(options.entrypointFile)
  const reExportSources = collectReExportSources(entrypointFile, options.projectContext)
  const scan: ScanContext = {
    entrypointFile,
    reExportSources,
    projectContext: options.projectContext,
  }
  const importers = scanSourceTree(options.sourceDir, exportedSymbolSet, scan)

  for (const importer of importers) {
    const consumerGroup = getConsumerGroup(importer.filePath, options.sourceDir)
    for (const symbol of importer.symbols) {
      bySymbol.get(symbol)?.add(consumerGroup)
    }
  }
  return bySymbol
}

interface AnalysisOptions {
  entrypointFile: string
  sourceDir: string
  projectContext: ProjectContext
}

function reportUnsharedSymbols(
  context: Rule.RuleContext,
  node: Program,
  groupsBySymbol: Map<string, Set<string>>,
): void {
  for (const [symbol, groups] of groupsBySymbol) {
    if (groups.size >= MIN_CONSUMER_GROUPS) continue
    context.report({
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

const MIN_CONSUMER_GROUPS = 2

function collectExportedSymbols(program: Program): string[] {
  const symbols = new Set<string>()
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    addSymbolsFromExportNamed(statement, symbols)
  }
  return [...symbols]
}

function addSymbolsFromExportNamed(node: ExportNamedDeclaration, symbols: Set<string>): void {
  for (const specifier of node.specifiers) {
    if (specifier.exported.type !== 'Identifier') continue
    symbols.add(specifier.exported.name)
  }
  if (node.declaration == null) return
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

function scanSourceTree(
  sourceDir: string,
  exportedSymbols: Set<string>,
  scan: ScanContext,
): SymbolImporter[] {
  const importers: SymbolImporter[] = []
  for (const filePath of scan.projectContext.listSourceFiles(sourceDir)) {
    if (normalizePath(filePath) === scan.entrypointFile) continue
    const symbols = getImportedSymbols(filePath, exportedSymbols, scan)
    if (symbols.length === 0) continue
    importers.push({ filePath, symbols })
  }
  return importers
}

interface SymbolImporter {
  filePath: string
  symbols: string[]
}

function getImportedSymbols(
  filePath: string,
  exportedSymbols: Set<string>,
  scan: ScanContext,
): string[] {
  const result = new Set<string>()
  for (const declaration of scan.projectContext.getImportDeclarations(filePath)) {
    addMatchingSymbols({
      symbolNames: declaration.getNamedImports().map((specifier) => specifier.getName()),
      specifier: declaration.getModuleSpecifierValue(),
      filePath,
      exportedSymbols,
      scan,
      result,
    })
  }
  const sourceFile = scan.projectContext.getSourceFile(filePath)
  if (sourceFile === undefined) return [...result]
  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue()
    if (specifier === undefined || specifier.length === 0) continue
    addMatchingSymbols({
      symbolNames: declaration.getNamedExports().map((exported) => exported.getName()),
      specifier,
      filePath,
      exportedSymbols,
      scan,
      result,
    })
  }
  return [...result]
}

function addMatchingSymbols(options: MatchOptions): void {
  const resolved = options.scan.projectContext.resolveLocalSpecifier(
    options.filePath,
    options.specifier,
  )
  if (resolved === undefined) return
  const normalized = normalizePath(resolved)
  if (normalized !== options.scan.entrypointFile && !options.scan.reExportSources.has(normalized)) {
    return
  }
  for (const name of options.symbolNames) {
    if (name.length === 0) continue
    if (!options.exportedSymbols.has(name)) continue
    options.result.add(name)
  }
}

interface MatchOptions {
  symbolNames: readonly string[]
  specifier: string
  filePath: string
  exportedSymbols: Set<string>
  scan: ScanContext
  result: Set<string>
}

interface ScanContext {
  entrypointFile: string
  reExportSources: Set<string>
  projectContext: ProjectContext
}

function collectReExportSources(
  entrypointFile: string,
  projectContext: ProjectContext,
): Set<string> {
  const sources = new Set<string>()
  const sourceFile = projectContext.getSourceFile(entrypointFile)
  if (sourceFile === undefined) return sources
  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue()
    if (specifier === undefined || specifier.length === 0) continue
    const resolved = projectContext.resolveLocalSpecifier(entrypointFile, specifier)
    if (resolved === undefined) continue
    sources.add(normalizePath(resolved))
  }
  return sources
}
