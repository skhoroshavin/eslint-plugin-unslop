import node_fs from 'node:fs'

import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportNamedDeclaration, Program } from 'estree'

import {
  getTsconfigInfo,
  getDeclarationNamesFromExport,
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  normalizePath,
  readArchitecturePolicy,
  resolvePathAlias,
  resolveImportTarget,
} from '../../utils/index.js'

import type { TsconfigInfo } from '../../utils/index.js'

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

    const policy = readArchitecturePolicy(context)
    if (policy === undefined) return {}

    const tsconfigInfo = getTsconfigInfo(filename)
    if (tsconfigInfo === undefined) return {}

    const matched = matchFileToArchitectureModule(filename, policy)
    if (matched === undefined || !matched.policy.shared) return {}
    if (!isPublicEntrypoint(filename)) return {}

    const sourceRoot = tsconfigInfo.sourceRoot
    if (sourceRoot === undefined) return {}

    const projectRoot = tsconfigInfo.projectRoot
    const sourceDir = node_path.join(projectRoot, sourceRoot)

    return {
      Program(node) {
        reportUnsharedSymbols(context, node, {
          entrypointFile: filename,
          sourceDir,
          tsconfigInfo,
        })
      },
    }
  },
} satisfies Rule.RuleModule

function reportUnsharedSymbols(
  context: Rule.RuleContext,
  node: Program,
  options: SymbolAnalysisOptions,
): void {
  const exportedSymbols = collectExportedSymbols(node)
  if (exportedSymbols.length === 0) return

  const consumerGroupsBySymbol = findConsumerGroupsBySymbol(
    options.entrypointFile,
    options.sourceDir,
    options.tsconfigInfo,
    exportedSymbols,
  )

  for (const symbol of exportedSymbols) {
    const consumerGroups = consumerGroupsBySymbol.get(symbol)
    if (consumerGroups !== undefined && consumerGroups.size >= MIN_CONSUMER_GROUPS) continue
    const groups = consumerGroups ?? new Set<string>()
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
  if (node.declaration === null || node.declaration === undefined) return
  for (const name of getDeclarationNamesFromExport(node.declaration)) {
    symbols.add(name)
  }
}

function findConsumerGroupsBySymbol(
  entrypointFile: string,
  sourceDir: string,
  tsconfigInfo: TsconfigInfo,
  exportedSymbols: string[],
): Map<string, Set<string>> {
  const bySymbol = new Map<string, Set<string>>()
  for (const symbol of exportedSymbols) {
    bySymbol.set(symbol, new Set<string>())
  }

  const importers = findImporters(entrypointFile, sourceDir, tsconfigInfo, new Set(exportedSymbols))
  for (const importer of importers) {
    const consumerGroup = getConsumerGroup(importer.filePath, sourceDir)
    for (const symbol of importer.symbols) {
      bySymbol.get(symbol)?.add(consumerGroup)
    }
  }
  return bySymbol
}

function findImporters(
  entrypointFile: string,
  sourceDir: string,
  tsconfigInfo: TsconfigInfo,
  exportedSymbols: Set<string>,
): SymbolImporter[] {
  const options: ConsumerScanOptions = {
    entrypointFile,
    tsconfigInfo,
    exportedSymbols,
    importers: [],
  }
  scanDir(sourceDir, options)
  return options.importers
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

interface SymbolAnalysisOptions {
  entrypointFile: string
  sourceDir: string
  tsconfigInfo: TsconfigInfo
}

// eslint-disable-next-line unslop/read-friendly-order
const LOCAL_SOURCE_RE = /(?:import|export)\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g

function scanDir(dir: string, options: ConsumerScanOptions): void {
  let entries: node_fs.Dirent[]
  try {
    entries = node_fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = node_path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDirectoryEntry(fullPath, options)
      continue
    }
    scanFileEntry(fullPath, options)
  }
}

function scanDirectoryEntry(directoryPath: string, options: ConsumerScanOptions): void {
  const baseName = node_path.basename(directoryPath)
  if (baseName === 'node_modules' || baseName === '.git') return
  scanDir(directoryPath, options)
}

function scanFileEntry(filePath: string, options: ConsumerScanOptions): void {
  if (!isSourceFile(filePath)) return
  if (normalizePath(filePath) === normalizePath(options.entrypointFile)) return

  const symbols = getImportedSymbols(
    filePath,
    options.entrypointFile,
    options.tsconfigInfo,
    options.exportedSymbols,
  )
  if (symbols.length === 0) return
  options.importers.push({ filePath, symbols })
}

function isSourceFile(filePath: string): boolean {
  return /\.[jt]sx?$/.test(filePath)
}

function getImportedSymbols(
  filePath: string,
  entrypointFile: string,
  tsconfigInfo: TsconfigInfo,
  exportedSymbols: Set<string>,
): string[] {
  let content: string
  try {
    content = node_fs.readFileSync(filePath, 'utf-8')
  } catch {
    return []
  }

  const result = new Set<string>()
  const matcher = new RegExp(LOCAL_SOURCE_RE)
  let match: RegExpExecArray | null
  while ((match = matcher.exec(content)) !== null) {
    const clause = match[1]
    const specifier = match[2]
    const resolvedTarget = resolveTarget(filePath, specifier, tsconfigInfo)
    if (!isSamePath(resolvedTarget, entrypointFile)) continue
    const names = extractNamedSymbols(clause)
    for (const name of names) {
      if (!exportedSymbols.has(name)) continue
      result.add(name)
    }
  }
  return [...result]
}

function resolveTarget(
  filePath: string,
  specifier: string,
  tsconfigInfo: TsconfigInfo,
): string | undefined {
  if (specifier.startsWith('.')) {
    return resolveImportTarget(filePath, tsconfigInfo, specifier)
  }
  return resolvePathAlias(specifier, tsconfigInfo)
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

interface ConsumerScanOptions {
  entrypointFile: string
  tsconfigInfo: TsconfigInfo
  exportedSymbols: Set<string>
  importers: SymbolImporter[]
}
