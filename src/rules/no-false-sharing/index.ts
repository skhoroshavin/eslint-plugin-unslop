import node_fs from 'node:fs'

import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportNamedDeclaration, Program } from 'estree'

import {
  ArchitecturePolicyResolver,
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

    const projectRoot = deriveProjectRoot(filename, sourceRoot)
    if (projectRoot === undefined) return {}
    const sourceDir = node_path.join(projectRoot, sourceRoot)
    const analyzer = new NoFalseSharingAnalyzer(context, {
      resolver,
      entrypointFile: filename,
      sourceDir,
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
      resolver: options.resolver,
      entrypointFile: options.entrypointFile,
    })
  }

  private readonly scanner: SymbolUsageScanner

  analyzeProgram(node: Program): void {
    const exportedSymbols = collectExportedSymbols(node)
    if (exportedSymbols.length === 0) return

    const consumerGroupsBySymbol = this.findConsumerGroupsBySymbol(exportedSymbols)
    this.reportUnsharedSymbols(node, exportedSymbols, consumerGroupsBySymbol)
  }

  private findConsumerGroupsBySymbol(exportedSymbols: string[]): Map<string, Set<string>> {
    const bySymbol = initializeConsumerGroupsBySymbol(exportedSymbols)
    const importers = this.scanner.scanSourceTree(this.options.sourceDir, new Set(exportedSymbols))
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
    exportedSymbols: string[],
    consumerGroupsBySymbol: Map<string, Set<string>>,
  ): void {
    for (const symbol of exportedSymbols) {
      const groups = consumerGroupsBySymbol.get(symbol) ?? new Set<string>()
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

function deriveProjectRoot(filename: string, sourceRoot: string): string | undefined {
  const normalized = normalizePath(filename)
  const marker = `/${sourceRoot}/`
  const index = normalized.indexOf(marker)
  if (index === -1) return undefined
  return normalized.slice(0, index)
}

// eslint-disable-next-line unslop/read-friendly-order
const LOCAL_SOURCE_RE = /(?:import|export)\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g

class SymbolUsageScanner {
  constructor(private readonly options: ScannerOptions) {}

  scanSourceTree(sourceDir: string, exportedSymbols: Set<string>): SymbolImporter[] {
    const importers: SymbolImporter[] = []
    this.scanDir(sourceDir, { exportedSymbols, importers })
    return importers
  }

  private scanDir(dir: string, state: ScanState): void {
    const entries = readDirectoryEntries(dir)
    if (entries === undefined) return
    for (const entry of entries) {
      this.scanEntry(dir, entry, state)
    }
  }

  private scanEntry(dir: string, entry: node_fs.Dirent, state: ScanState): void {
    const fullPath = node_path.join(dir, entry.name)
    if (entry.isDirectory()) {
      this.scanDirectory(fullPath, state)
      return
    }
    this.scanFile(fullPath, state)
  }

  private scanDirectory(directoryPath: string, state: ScanState): void {
    const baseName = node_path.basename(directoryPath)
    if (baseName === 'node_modules' || baseName === '.git') return
    this.scanDir(directoryPath, state)
  }

  private scanFile(filePath: string, state: ScanState): void {
    if (!isSourceFile(filePath)) return
    if (normalizePath(filePath) === normalizePath(this.options.entrypointFile)) return
    const symbols = this.getImportedSymbols(filePath, state.exportedSymbols)
    if (symbols.length === 0) return
    state.importers.push({ filePath, symbols })
  }

  private getImportedSymbols(filePath: string, exportedSymbols: Set<string>): string[] {
    const content = readFileContent(filePath)
    if (content === undefined) return []
    const result = new Set<string>()
    const matcher = new RegExp(LOCAL_SOURCE_RE)
    let match: RegExpExecArray | null
    while ((match = matcher.exec(content)) !== null) {
      const clause = match[1]
      const specifier = match[2]
      const resolvedTarget = this.options.resolver.resolveImportTarget(filePath, specifier)
      if (!isSamePath(resolvedTarget, this.options.entrypointFile)) continue
      this.addMatchingNamedSymbols(result, clause, exportedSymbols)
    }
    return [...result]
  }

  private addMatchingNamedSymbols(
    result: Set<string>,
    clause: string,
    exportedSymbols: Set<string>,
  ): void {
    for (const name of extractNamedSymbols(clause)) {
      if (!exportedSymbols.has(name)) continue
      result.add(name)
    }
  }
}

function readDirectoryEntries(dir: string): node_fs.Dirent[] | undefined {
  try {
    return node_fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return undefined
  }
}

function isSourceFile(filePath: string): boolean {
  return /\.[jt]sx?$/.test(filePath)
}

function readFileContent(filePath: string): string | undefined {
  try {
    return node_fs.readFileSync(filePath, 'utf-8')
  } catch {
    return undefined
  }
}

function isSamePath(value: string | undefined, expected: string): boolean {
  if (value === undefined) return false
  return normalizePath(value) === normalizePath(expected)
}

function extractNamedSymbols(clause: string): string[] {
  const openBrace = clause.indexOf('{')
  if (openBrace === -1) return []
  const closeBrace = clause.indexOf('}', openBrace + 1)
  if (closeBrace === -1) return []

  const rawList = clause.slice(openBrace + 1, closeBrace)
  const symbols: string[] = []
  for (const rawItem of rawList.split(',')) {
    const symbol = parseNamedSymbol(rawItem)
    if (symbol !== undefined) {
      symbols.push(symbol)
    }
  }
  return symbols
}

function parseNamedSymbol(raw: string): string | undefined {
  const trimmed = raw.trim().replace(/^type\s+/, '')
  if (trimmed.length === 0) return undefined
  const [left] = trimmed.split(/\s+as\s+/)
  if (left === undefined) return undefined
  const normalized = left.trim()
  return normalized.length > 0 ? normalized : undefined
}

interface SymbolImporter {
  filePath: string
  symbols: string[]
}

interface SymbolAnalysisOptions {
  resolver: ArchitecturePolicyResolver
  entrypointFile: string
  sourceDir: string
}

interface ScannerOptions {
  resolver: ArchitecturePolicyResolver
  entrypointFile: string
}

interface ScanState {
  exportedSymbols: Set<string>
  importers: SymbolImporter[]
}
