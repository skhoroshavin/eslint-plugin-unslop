import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportNamedDeclaration, Program } from 'estree'

import ts from 'typescript'

import {
  getArchitectureRuleState,
  getDeclarationNamesFromExport,
  getRelativePath,
  isInsidePath,
  isPublicEntrypoint,
  isSamePath,
  matchFileToArchitectureModule,
  normalizeResolvedPath,
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
    const state = buildRuleState(context)
    if (state === undefined) return {}

    return {
      Program(node) {
        reportUnsharedSymbols(context, node, state)
      },
    }
  },
} satisfies Rule.RuleModule

function buildRuleState(context: Rule.RuleContext): SymbolAnalysisOptions | undefined {
  const state = getArchitectureRuleState(context)
  if (state === undefined || !isPublicEntrypoint(state.filename)) return undefined
  if (!state.moduleMatch.policy.shared) return undefined

  const sourceRoot = state.policy.projectContext.sourceRoot
  if (sourceRoot === undefined) return undefined

  return {
    entrypointFile: state.filename,
    sourceDir: node_path.join(state.policy.projectContext.projectRoot, sourceRoot),
    policy: state.policy,
    sharedModuleInstance: state.moduleMatch.instance,
  }
}

function reportUnsharedSymbols(
  context: Rule.RuleContext,
  node: Program,
  options: SymbolAnalysisOptions,
): void {
  const declaredExportNames = collectDeclaredExportNames(node)
  const exportedSymbols = collectExportedSymbols(options.entrypointFile, options.policy)
  if (exportedSymbols.length === 0) return
  if (declaredExportNames.size > 0) {
    exportedSymbols.sort((left, right) =>
      compareExportedSymbolOrder(left, right, declaredExportNames),
    )
  }

  const consumerGroupsBySymbol = findConsumerGroupsBySymbol({ ...options, exportedSymbols })
  for (const symbol of exportedSymbols) {
    const consumerGroups = consumerGroupsBySymbol.get(symbol.exportedName)
    if (consumerGroups === undefined) continue
    if (consumerGroups.size >= 2) continue
    context.report({
      node,
      messageId: 'notTrulyShared',
      data: {
        symbol: symbol.exportedName,
        consumerCount: String(consumerGroups.size),
        consumerGroup: getSingleConsumerGroup(consumerGroups),
      },
    })
  }
}

function collectDeclaredExportNames(program: Program): Set<string> {
  const names = new Set<string>()
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    addNamesFromExportNamed(statement, names)
  }
  return names
}

function addNamesFromExportNamed(node: ExportNamedDeclaration, names: Set<string>): void {
  if (node.declaration === null) return
  for (const name of getDeclarationNamesFromExport(node.declaration)) {
    names.add(name)
  }
}

function compareExportedSymbolOrder(
  left: ExportedSymbolTarget,
  right: ExportedSymbolTarget,
  declaredExportNames: Set<string>,
): number {
  const leftDeclared = declaredExportNames.has(left.exportedName)
  const rightDeclared = declaredExportNames.has(right.exportedName)
  if (leftDeclared !== rightDeclared) {
    return leftDeclared ? -1 : 1
  }
  return left.exportedName.localeCompare(right.exportedName)
}

function collectExportedSymbols(
  entrypointFile: string,
  policy: RuleArchitecturePolicy,
): ExportedSymbolTarget[] {
  const sourceFile = findProjectSourceFile(policy.projectContext.program, entrypointFile)
  if (sourceFile === undefined) return []

  const moduleSymbol = policy.projectContext.checker.getSymbolAtLocation(sourceFile)
  if (moduleSymbol === undefined) return []

  const symbols = new Map<string, ExportedSymbolTarget>()
  for (const exported of policy.projectContext.checker.getExportsOfModule(moduleSymbol)) {
    const canonical = getCanonicalSymbol(policy.projectContext.checker, exported)
    const canonicalKey = getCanonicalSymbolKey(canonical)
    if (canonicalKey === undefined) continue

    const exportedName = exported.getName()
    symbols.set(exportedName, {
      exportedName,
      canonicalKey,
      backingFile: getBackingFilePath(canonical, entrypointFile),
    })
  }
  return [...symbols.values()]
}

function findProjectSourceFile(program: ts.Program, targetFile: string): ts.SourceFile | undefined {
  const normalizedTarget = normalizeResolvedPath(targetFile)
  for (const sourceFile of program.getSourceFiles()) {
    const normalized = normalizeResolvedPath(sourceFile.fileName)
    if (normalized === normalizedTarget) return sourceFile
  }
  return undefined
}

function getCanonicalSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
  if ((symbol.flags & ts.SymbolFlags.Alias) === 0) return symbol
  return checker.getAliasedSymbol(symbol)
}

function getCanonicalSymbolKey(symbol: ts.Symbol): string | undefined {
  const declaration = pickPrimaryDeclaration(symbol)
  if (declaration === undefined) return undefined
  const sourceFilePath = normalizeResolvedPath(declaration.getSourceFile().fileName)
  return `${sourceFilePath}:${declaration.pos}:${declaration.end}:${symbol.getName()}`
}

function pickPrimaryDeclaration(symbol: ts.Symbol): ts.Declaration | undefined {
  const declarations = symbol.declarations
  if (declarations === undefined || declarations.length === 0) return undefined
  for (const declaration of declarations) {
    if (!declaration.getSourceFile().isDeclarationFile) return declaration
  }
  return declarations[0]
}

function getBackingFilePath(symbol: ts.Symbol, entrypointFile: string): string | undefined {
  const declaration = pickPrimaryDeclaration(symbol)
  if (declaration === undefined) return undefined
  const declarationFile = node_path.resolve(declaration.getSourceFile().fileName)
  if (isSamePath(declarationFile, entrypointFile)) return undefined
  return declarationFile
}

function findConsumerGroupsBySymbol(options: ConsumerGroupOptions): Map<string, Set<string>> {
  const bySymbol = new Map<string, Set<string>>()
  const exportedByCanonical = new Map<string, ExportedSymbolTarget[]>()
  for (const symbol of options.exportedSymbols) {
    bySymbol.set(symbol.exportedName, new Set<string>())
    const existing = exportedByCanonical.get(symbol.canonicalKey)
    if (existing === undefined) {
      exportedByCanonical.set(symbol.canonicalKey, [symbol])
      continue
    }
    existing.push(symbol)
  }

  for (const sourceFile of options.policy.projectContext.program.getSourceFiles()) {
    collectConsumerGroupsFromFile(sourceFile, options, exportedByCanonical, bySymbol)
  }
  return bySymbol
}

function collectConsumerGroupsFromFile(
  sourceFile: ts.SourceFile,
  options: ConsumerGroupOptions,
  exportedByCanonical: Map<string, ExportedSymbolTarget[]>,
  bySymbol: Map<string, Set<string>>,
): void {
  const filePath = node_path.resolve(sourceFile.fileName)
  if (!isProjectSourceFile(filePath, options)) return

  const moduleMatch = matchFileToArchitectureModule(filePath, options.policy)
  const isInternalConsumer = moduleMatch?.instance === options.sharedModuleInstance
  const usages = collectImportedSymbolUsages(sourceFile, options.policy.projectContext)

  for (const usage of usages) {
    const exportedSymbols = exportedByCanonical.get(usage.canonicalKey)
    if (exportedSymbols === undefined) continue
    addUsageToConsumerGroups({
      usage,
      exportedSymbols,
      filePath,
      sourceDir: options.sourceDir,
      isInternalConsumer,
      sharedModuleInstance: options.sharedModuleInstance,
      bySymbol,
      entrypointFile: options.entrypointFile,
    })
  }
}

function isProjectSourceFile(filePath: string, options: ConsumerGroupOptions): boolean {
  if (isSamePath(filePath, options.entrypointFile)) return false
  if (!isInsidePath(options.sourceDir, filePath)) return false
  return /\.[jt]sx?$/.test(filePath)
}

function collectImportedSymbolUsages(
  sourceFile: ts.SourceFile,
  projectContext: RuleArchitecturePolicy['projectContext'],
): SymbolUsage[] {
  const usages: SymbolUsage[] = []
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      addImportDeclarationUsages(statement, sourceFile, projectContext, usages)
      continue
    }
    if (ts.isExportDeclaration(statement)) {
      addExportDeclarationUsages(statement, sourceFile, projectContext, usages)
    }
  }
  return usages
}

function addImportDeclarationUsages(
  statement: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  projectContext: RuleArchitecturePolicy['projectContext'],
  usages: SymbolUsage[],
): void {
  const targetFile = getResolvedTargetFile(statement.moduleSpecifier, sourceFile, projectContext)
  if (targetFile === undefined) return
  if (statement.importClause === undefined) return

  if (statement.importClause.name !== undefined) {
    addIdentifierUsage(statement.importClause.name, targetFile, projectContext, usages)
  }

  const namedBindings = statement.importClause.namedBindings
  if (namedBindings === undefined || !ts.isNamedImports(namedBindings)) return
  for (const element of namedBindings.elements) {
    addIdentifierUsage(element.name, targetFile, projectContext, usages)
  }
}

function addExportDeclarationUsages(
  statement: ts.ExportDeclaration,
  sourceFile: ts.SourceFile,
  projectContext: RuleArchitecturePolicy['projectContext'],
  usages: SymbolUsage[],
): void {
  const targetFile = getResolvedTargetFile(statement.moduleSpecifier, sourceFile, projectContext)
  if (targetFile === undefined) return
  if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) return

  for (const element of statement.exportClause.elements) {
    const reference = element.propertyName ?? element.name
    if (!ts.isIdentifier(reference)) continue
    addIdentifierUsage(reference, targetFile, projectContext, usages)
  }
}

function getResolvedTargetFile(
  moduleSpecifier: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
  projectContext: RuleArchitecturePolicy['projectContext'],
): string | undefined {
  if (moduleSpecifier === undefined || !ts.isStringLiteral(moduleSpecifier)) return undefined
  return resolveImportTarget(sourceFile.fileName, projectContext, moduleSpecifier.text)
}

function addIdentifierUsage(
  identifier: ts.Identifier,
  targetFile: string,
  projectContext: RuleArchitecturePolicy['projectContext'],
  usages: SymbolUsage[],
): void {
  const symbol = projectContext.checker.getSymbolAtLocation(identifier)
  if (symbol === undefined) return

  const canonicalSymbol = getCanonicalSymbol(projectContext.checker, symbol)
  const canonicalKey = getCanonicalSymbolKey(canonicalSymbol)
  if (canonicalKey === undefined) return
  usages.push({ canonicalKey, targetFile })
}

function addUsageToConsumerGroups(options: AddUsageOptions): void {
  for (const symbol of options.exportedSymbols) {
    const kind = getConsumerKind(options, symbol)
    if (kind === undefined) continue
    const consumerGroup =
      kind === 'internal'
        ? getInternalConsumerGroup(options.sharedModuleInstance)
        : getConsumerGroup(options.filePath, options.sourceDir)
    options.bySymbol.get(symbol.exportedName)?.add(consumerGroup)
  }
}

function getConsumerKind(
  options: AddUsageOptions,
  symbol: ExportedSymbolTarget,
): ConsumerKind | undefined {
  if (isSamePath(options.usage.targetFile, options.entrypointFile)) {
    return options.isInternalConsumer ? 'internal' : 'public'
  }
  if (!options.isInternalConsumer || symbol.backingFile === undefined) return undefined
  if (isSamePath(options.usage.targetFile, symbol.backingFile)) return 'internal'
  return undefined
}

function getConsumerGroup(importerPath: string, sourceDir: string): string {
  const rel = getRelativePath(sourceDir, importerPath)
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
  policy: RuleArchitecturePolicy
  sharedModuleInstance: string
}

interface ConsumerGroupOptions extends SymbolAnalysisOptions {
  exportedSymbols: ExportedSymbolTarget[]
}

interface SymbolUsage {
  canonicalKey: string
  targetFile: string
}

interface AddUsageOptions {
  usage: SymbolUsage
  exportedSymbols: ExportedSymbolTarget[]
  filePath: string
  sourceDir: string
  isInternalConsumer: boolean
  sharedModuleInstance: string
  bySymbol: Map<string, Set<string>>
  entrypointFile: string
}

interface ExportedSymbolTarget {
  exportedName: string
  canonicalKey: string
  backingFile?: string
}

type RuleArchitecturePolicy = NonNullable<ReturnType<typeof getArchitectureRuleState>>['policy']

type ConsumerKind = 'internal' | 'public'
