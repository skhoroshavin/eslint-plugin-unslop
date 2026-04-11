import type { Rule, Scope } from 'eslint'

import type { Node, Program, VariableDeclaration, VariableDeclarator, Identifier } from 'estree'

import ts from 'typescript'

import {
  getTypeScriptProjectContext,
  isFileInProject,
  normalizeResolvedPath,
} from '../../utils/index.js'

import type { ProjectContext } from '../../utils/index.js'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow module-scope constants used only once (or never) across the project',
      recommended: false,
    },
    schema: [],
    messages: {
      singleUse:
        'constant "{{name}}" has only {{count}} real use(s) across the project; inline or remove it',
    },
  },
  create(context) {
    const filename = context.filename
    const exportedNames = new Set<string>()
    let programNode: Program | undefined

    return {
      Program(node) {
        programNode = node
        collectExportedNames(node, exportedNames)
      },
      'Program:exit'() {
        if (programNode === undefined) return
        const tsContext = filename.length > 0 ? getTypeScriptProjectContext(filename) : undefined
        analyzeProgram({ ruleCtx: context, exportedNames, tsContext, filename }, programNode)
      },
    }
  },
} satisfies Rule.RuleModule

function analyzeProgram(analysisCtx: AnalysisContext, program: Program): void {
  for (const stmt of program.body) {
    const decl = extractConstDeclaration(stmt)
    if (decl === undefined) continue
    for (const declarator of decl.declarators) {
      checkDeclarator(analysisCtx, declarator)
    }
  }
}

function checkDeclarator(analysisCtx: AnalysisContext, declarator: VariableDeclarator): void {
  if (declarator.id.type !== 'Identifier') return
  if (isExcludedInitializer(declarator)) return

  const { ruleCtx, exportedNames } = analysisCtx
  const name = declarator.id.name
  const isExported = exportedNames.has(name)
  const count = resolveUseCount(analysisCtx, declarator, name, isExported)

  if (count === undefined || count > 1) return

  ruleCtx.report({
    node: declarator,
    messageId: 'singleUse',
    data: { name, count: String(count) },
  })
}

function resolveUseCount(
  analysisCtx: AnalysisContext,
  declarator: VariableDeclarator,
  name: string,
  isExported: boolean,
): number | undefined {
  const { ruleCtx, tsContext, filename } = analysisCtx
  if (isExported) {
    if (tsContext === undefined || !isFileInProject(filename, tsContext)) return undefined
    return countExportedUses(name, filename, tsContext)
  }
  return countLocalReadRefs(ruleCtx.sourceCode.getDeclaredVariables(declarator))
}

interface AnalysisContext {
  ruleCtx: Rule.RuleContext
  exportedNames: Set<string>
  tsContext: ProjectContext | undefined
  filename: string
}

function extractConstDeclaration(stmt: Node): { declarators: VariableDeclarator[] } | undefined {
  let decl: VariableDeclaration | undefined
  if (stmt.type === 'ExportNamedDeclaration') {
    if (stmt.declaration?.type === 'VariableDeclaration') {
      decl = stmt.declaration
    }
  } else if (stmt.type === 'VariableDeclaration') {
    decl = stmt
  }
  if (decl === undefined || decl.kind !== 'const') return undefined
  return { declarators: decl.declarations }
}

function isExcludedInitializer(declarator: VariableDeclarator): boolean {
  const init = declarator.init
  if (init === null || init === undefined) return false
  return (
    init.type === 'ArrowFunctionExpression' ||
    init.type === 'FunctionExpression' ||
    init.type === 'ClassExpression'
  )
}

function collectExportedNames(program: Program, names: Set<string>): void {
  for (const stmt of program.body) {
    if (stmt.type === 'ExportNamedDeclaration') {
      collectNamesFromExportNamed(stmt, names)
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      if (isEstreeIdentifier(stmt.declaration)) {
        names.add(stmt.declaration.name)
      }
    }
  }
}

function collectNamesFromExportNamed(
  stmt: Extract<Node, { type: 'ExportNamedDeclaration' }>,
  names: Set<string>,
): void {
  if (stmt.declaration?.type === 'VariableDeclaration') {
    for (const d of stmt.declaration.declarations) {
      if (d.id.type === 'Identifier') names.add(d.id.name)
    }
  }
  for (const specifier of stmt.specifiers) {
    if (isEstreeIdentifier(specifier.local)) names.add(specifier.local.name)
  }
}

// Type predicate to work around TypeScript's limited narrowing of
// ExpressionMap[keyof ExpressionMap] by discriminant.
function isEstreeIdentifier(node: { type: string }): node is Identifier {
  return node.type === 'Identifier'
}

function countLocalReadRefs(declaredVars: Scope.Variable[]): number {
  let total = 0
  for (const variable of declaredVars) {
    total += variable.references.filter((ref) => ref.isRead()).length
  }
  return total
}

function countExportedUses(
  name: string,
  filename: string,
  tsContext: ProjectContext,
): number | undefined {
  const sourceFile = findTsSourceFile(tsContext.program, filename)
  if (sourceFile === undefined) return undefined

  const targetSymbol = findDeclarationSymbol(sourceFile, name, tsContext.checker)
  if (targetSymbol === undefined) return undefined

  return countProjectWideUses(targetSymbol, tsContext.checker, tsContext.program)
}

function findTsSourceFile(program: ts.Program, filename: string): ts.SourceFile | undefined {
  const normalized = normalizeResolvedPath(filename)
  for (const sf of program.getSourceFiles()) {
    if (normalizeResolvedPath(sf.fileName) === normalized) return sf
  }
  return undefined
}

function findDeclarationSymbol(
  sourceFile: ts.SourceFile,
  name: string,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue
    if ((stmt.declarationList.flags & ts.NodeFlags.Const) === 0) continue
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue
      return checker.getSymbolAtLocation(decl.name)
    }
  }
  return undefined
}

function countProjectWideUses(
  targetSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  program: ts.Program,
): number {
  let total = 0
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue
    total += countUsesInFile(sf, targetSymbol, checker)
  }
  return total
}

function countUsesInFile(
  sourceFile: ts.SourceFile,
  targetSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): number {
  let count = 0

  function walk(node: ts.Node): void {
    if (ts.isIdentifier(node) && isCountableUse(node, targetSymbol, checker)) {
      count++
    }
    ts.forEachChild(node, walk)
  }

  walk(sourceFile)
  return count
}

function isCountableUse(
  node: ts.Identifier,
  targetSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): boolean {
  if (!isRealUsagePosition(node)) return false
  const sym = checker.getSymbolAtLocation(node)
  if (sym === undefined) return false
  return resolveCanonicalSymbol(sym, checker) === targetSymbol
}

function isRealUsagePosition(node: ts.Identifier): boolean {
  const parent = node.parent
  if (isDeclarationBinding(parent, node)) return false
  if (isImportPosition(parent, node)) return false
  if (ts.isExportSpecifier(parent)) return false
  if (ts.isExportAssignment(parent)) return false
  return true
}

function isDeclarationBinding(parent: ts.Node, node: ts.Identifier): boolean {
  return ts.isVariableDeclaration(parent) && parent.name === node
}

function isImportPosition(parent: ts.Node, node: ts.Identifier): boolean {
  if (ts.isImportSpecifier(parent)) return true
  if (ts.isImportClause(parent) && parent.name === node) return true
  return ts.isNamespaceImport(parent) && parent.name === node
}

function resolveCanonicalSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if ((symbol.flags & ts.SymbolFlags.Alias) === 0) return symbol
  return checker.getAliasedSymbol(symbol)
}
