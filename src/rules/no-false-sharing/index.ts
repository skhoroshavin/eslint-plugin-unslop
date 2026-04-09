import node_fs from 'node:fs'

import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportNamedDeclaration, ImportDeclaration, Program } from 'estree'

import {
  getDeclarationNamesFromExport,
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  normalizePath,
  readArchitecturePolicy,
  resolveImportTarget,
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

    const policy = readArchitecturePolicy(context)
    if (policy === undefined) return {}

    const matched = matchFileToArchitectureModule(filename, policy)
    if (matched === undefined || !matched.policy.shared) return {}
    if (!isPublicEntrypoint(filename)) return {}

    const tsconfigInfo = policy.tsconfigInfo
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
          policy,
          sharedModuleInstance: matched.instance,
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
  const exportedSymbols = collectExportedSymbols(node, options.entrypointFile, options.tsconfigInfo)
  if (exportedSymbols.length === 0) return

  const consumerGroupsBySymbol = findConsumerGroupsBySymbol({ ...options, exportedSymbols })

  for (const symbol of exportedSymbols) {
    const consumerGroups = consumerGroupsBySymbol.get(symbol.exportedName)
    if (consumerGroups !== undefined && consumerGroups.size >= MIN_CONSUMER_GROUPS) continue
    const groups = consumerGroups ?? new Set<string>()
    context.report({
      node,
      messageId: 'notTrulyShared',
      data: {
        symbol: symbol.exportedName,
        consumerCount: String(groups.size),
        consumerGroup: getSingleConsumerGroup(groups),
      },
    })
  }
}

const MIN_CONSUMER_GROUPS = 2

function collectExportedSymbols(
  program: Program,
  entrypointFile: string,
  tsconfigInfo: TsconfigInfo,
): ExportedSymbolTarget[] {
  const importedTargets = collectImportedTargets(program, entrypointFile, tsconfigInfo)
  const symbols = new Map<string, ExportedSymbolTarget>()
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    addSymbolsFromExportNamed(statement, symbols, {
      importedTargets,
      entrypointFile,
      tsconfigInfo,
    })
  }
  return [...symbols.values()]
}

function collectImportedTargets(
  program: Program,
  entrypointFile: string,
  tsconfigInfo: TsconfigInfo,
): Map<string, string> {
  const importedTargets = new Map<string, string>()
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue
    addImportedTargetsFromDeclaration(statement, importedTargets, entrypointFile, tsconfigInfo)
  }
  return importedTargets
}

function addImportedTargetsFromDeclaration(
  node: ImportDeclaration,
  importedTargets: Map<string, string>,
  entrypointFile: string,
  tsconfigInfo: TsconfigInfo,
): void {
  if (typeof node.source.value !== 'string') return
  const target = resolveImportTarget(entrypointFile, tsconfigInfo, node.source.value)
  if (target === undefined) return
  for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportSpecifier' || specifier.type === 'ImportDefaultSpecifier') {
      importedTargets.set(specifier.local.name, target)
    }
  }
}

function addSymbolsFromExportNamed(
  node: ExportNamedDeclaration,
  symbols: Map<string, ExportedSymbolTarget>,
  options: ExportCollectionOptions,
): void {
  addSymbolsFromExportSpecifiers(node, symbols, options)
  addSymbolsFromExportDeclaration(node, symbols, options)
}

function addSymbolsFromExportSpecifiers(
  node: ExportNamedDeclaration,
  symbols: Map<string, ExportedSymbolTarget>,
  options: ExportCollectionOptions,
): void {
  const sourceTarget = getExportSourceTarget(node, options.entrypointFile, options.tsconfigInfo)
  for (const specifier of node.specifiers) {
    if (specifier.exported.type !== 'Identifier') continue
    if (specifier.local.type !== 'Identifier') continue
    upsertExportedSymbol(symbols, specifier.exported.name, {
      entrypointFile: options.entrypointFile,
      backingFile:
        sourceTarget ?? options.importedTargets.get(specifier.local.name) ?? options.entrypointFile,
    })
  }
}

function addSymbolsFromExportDeclaration(
  node: ExportNamedDeclaration,
  symbols: Map<string, ExportedSymbolTarget>,
  options: ExportCollectionOptions,
): void {
  if (node.declaration === null || node.declaration === undefined) return
  for (const name of getDeclarationNamesFromExport(node.declaration)) {
    upsertExportedSymbol(symbols, name, {
      entrypointFile: options.entrypointFile,
      backingFile: options.entrypointFile,
    })
  }
}

function getExportSourceTarget(
  node: ExportNamedDeclaration,
  entrypointFile: string,
  tsconfigInfo: TsconfigInfo,
): string | undefined {
  if (node.source === null || node.source === undefined) return undefined
  if (typeof node.source.value !== 'string') return undefined
  return resolveImportTarget(entrypointFile, tsconfigInfo, node.source.value)
}

function upsertExportedSymbol(
  symbols: Map<string, ExportedSymbolTarget>,
  exportedName: string,
  options: UpsertExportedSymbolOptions,
): void {
  const normalizedEntry = normalizePath(options.entrypointFile)
  const normalizedBacking = normalizePath(options.backingFile)
  const backingFile = normalizedBacking === normalizedEntry ? undefined : options.backingFile
  const existing = symbols.get(exportedName)
  if (existing === undefined) {
    symbols.set(exportedName, {
      exportedName,
      entrypointFile: options.entrypointFile,
      backingFile,
    })
    return
  }
  if (existing.backingFile === undefined && backingFile !== undefined) {
    symbols.set(exportedName, { ...existing, backingFile })
  }
}

function findConsumerGroupsBySymbol(options: ConsumerGroupOptions): Map<string, Set<string>> {
  const bySymbol = new Map<string, Set<string>>()
  for (const symbol of options.exportedSymbols) {
    bySymbol.set(symbol.exportedName, new Set<string>())
  }

  const importers = findImporters(options)
  for (const importer of importers) {
    const publicConsumerGroup = getConsumerGroup(importer.filePath, options.sourceDir)
    for (const symbol of importer.publicSymbols) {
      bySymbol.get(symbol)?.add(publicConsumerGroup)
    }
    for (const symbol of importer.internalSymbols) {
      bySymbol.get(symbol)?.add(getInternalConsumerGroup(importer.internalModuleInstance))
    }
  }
  return bySymbol
}

function findImporters(options: ImporterScanOptions): SymbolImporter[] {
  const byName = new Map<string, ExportedSymbolTarget>()
  for (const symbol of options.exportedSymbols) {
    byName.set(symbol.exportedName, symbol)
  }

  const scanOptions: ConsumerScanOptions = {
    entrypointFile: options.entrypointFile,
    tsconfigInfo: options.tsconfigInfo,
    policy: options.policy,
    sharedModuleInstance: options.sharedModuleInstance,
    exportedSymbolsByName: byName,
    importers: [],
  }
  scanDir(options.sourceDir, scanOptions)
  return scanOptions.importers
}

function getConsumerGroup(importerPath: string, sourceDir: string): string {
  const rel = normalizePath(node_path.relative(sourceDir, importerPath))
  const parts = rel.split('/')
  if (parts.length <= 1) return rel
  return parts.slice(0, -1).join('/')
}

function getInternalConsumerGroup(sharedModuleInstance: string): string {
  return `internal:${sharedModuleInstance}`
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
  policy: RuleArchitecturePolicy
  sharedModuleInstance: string
}

type RuleArchitecturePolicy = NonNullable<ReturnType<typeof readArchitecturePolicy>>
type TsconfigInfo = RuleArchitecturePolicy['tsconfigInfo']

interface ConsumerGroupOptions extends SymbolAnalysisOptions {
  exportedSymbols: ExportedSymbolTarget[]
}

interface ImporterScanOptions extends SymbolAnalysisOptions {
  exportedSymbols: ExportedSymbolTarget[]
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

  const moduleMatch = matchFileToArchitectureModule(filePath, options.policy)
  const moduleInstance = moduleMatch?.instance
  const isInternalConsumer = moduleInstance === options.sharedModuleInstance

  const symbols = getImportedSymbols({
    filePath,
    entrypointFile: options.entrypointFile,
    tsconfigInfo: options.tsconfigInfo,
    exportedSymbolsByName: options.exportedSymbolsByName,
    isInternalConsumer,
  })
  if (symbols.publicSymbols.length === 0 && symbols.internalSymbols.length === 0) return
  options.importers.push({
    filePath,
    publicSymbols: symbols.publicSymbols,
    internalSymbols: symbols.internalSymbols,
    internalModuleInstance: options.sharedModuleInstance,
  })
}

function isSourceFile(filePath: string): boolean {
  return /\.[jt]sx?$/.test(filePath)
}

function getImportedSymbols(options: ImportedSymbolOptions): ImportedSymbols {
  let content: string
  try {
    content = node_fs.readFileSync(options.filePath, 'utf-8')
  } catch {
    return { publicSymbols: [], internalSymbols: [] }
  }

  const publicSymbols = new Set<string>()
  const internalSymbols = new Set<string>()
  const matcher = new RegExp(LOCAL_SOURCE_RE)
  let match: RegExpExecArray | null
  while ((match = matcher.exec(content)) !== null) {
    const clause = match[1]
    const specifier = match[2]
    const resolvedTarget = resolveImportTarget(options.filePath, options.tsconfigInfo, specifier)
    const names = extractNamedSymbols(clause)
    for (const name of names) {
      const exportedSymbol = options.exportedSymbolsByName.get(name)
      if (exportedSymbol === undefined) continue
      const kind = getConsumerKind(
        resolvedTarget,
        options.entrypointFile,
        exportedSymbol,
        options.isInternalConsumer,
      )
      if (kind === undefined) continue
      if (kind === 'internal') {
        internalSymbols.add(name)
      } else {
        publicSymbols.add(name)
      }
    }
  }
  return {
    publicSymbols: [...publicSymbols],
    internalSymbols: [...internalSymbols],
  }
}

function getConsumerKind(
  resolvedTarget: string | undefined,
  entrypointFile: string,
  exportedSymbol: ExportedSymbolTarget,
  isInternalConsumer: boolean,
): ConsumerKind | undefined {
  if (isSamePath(resolvedTarget, entrypointFile)) {
    return isInternalConsumer ? 'internal' : 'public'
  }
  if (!isInternalConsumer || exportedSymbol.backingFile === undefined) return undefined
  return isSamePath(resolvedTarget, exportedSymbol.backingFile) ? 'internal' : undefined
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
  publicSymbols: string[]
  internalSymbols: string[]
  internalModuleInstance: string
}

interface ConsumerScanOptions {
  entrypointFile: string
  tsconfigInfo: TsconfigInfo
  policy: RuleArchitecturePolicy
  sharedModuleInstance: string
  exportedSymbolsByName: Map<string, ExportedSymbolTarget>
  importers: SymbolImporter[]
}

interface ImportedSymbols {
  publicSymbols: string[]
  internalSymbols: string[]
}

interface ImportedSymbolOptions {
  filePath: string
  entrypointFile: string
  tsconfigInfo: TsconfigInfo
  exportedSymbolsByName: Map<string, ExportedSymbolTarget>
  isInternalConsumer: boolean
}

type ConsumerKind = 'internal' | 'public'

interface ExportedSymbolTarget {
  exportedName: string
  entrypointFile: string
  backingFile?: string
}

interface ExportCollectionOptions {
  importedTargets: Map<string, string>
  entrypointFile: string
  tsconfigInfo: TsconfigInfo
}

interface UpsertExportedSymbolOptions {
  entrypointFile: string
  backingFile: string
}
