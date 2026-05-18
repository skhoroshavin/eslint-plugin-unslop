import type { Rule, Scope } from 'eslint'

import type { Node, Program, VariableDeclaration, VariableDeclarator, Identifier } from 'estree'

import ts from 'typescript'

import {
  formatProjectContextError,
  getRequiredTypeScriptProjectContext,
} from '../../utils/index.js'

import type { ProjectContext } from '../../utils/index.js'

import { countProjectWideUses, findTsSourceFile } from '../../utils/index.js'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow module-scope constants used only once (or never) across the project',
      recommended: false,
    },
    schema: [],
    messages: {
      configurationError: 'Configuration error: {{details}}',
      singleUse:
        'constant "{{name}}" has only {{count}} real use(s) across the project; inline or remove it',
    },
  },
  create(context) {
    const filename = context.filename
    const exportedNames = new Set<string>()

    return {
      Program(node) {
        collectExportedNames(node, exportedNames)
      },
      'Program:exit'(node: Program) {
        const projectContext =
          exportedNames.size > 0 && filename.length > 0
            ? getRequiredTypeScriptProjectContext(filename)
            : undefined
        if (projectContext?.kind === 'context-error') {
          context.report({
            node,
            messageId: 'configurationError',
            data: { details: formatProjectContextError(projectContext.error) },
          })
          return
        }

        const tsContext =
          projectContext?.kind === 'active' ? projectContext.projectContext : undefined
        analyzeProgram({ ruleCtx: context, exportedNames, tsContext, filename }, node)
      },
    }
  },
} satisfies Rule.RuleModule

function analyzeProgram(analysisCtx: AnalysisContext, program: Program): void {
  for (const stmt of program.body) {
    const declarators = extractConstDeclarators(stmt)
    if (declarators === undefined) continue
    for (const declarator of declarators) {
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
    if (tsContext === undefined) return undefined
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

function extractConstDeclarators(stmt: Node): VariableDeclarator[] | undefined {
  let decl: VariableDeclaration | undefined
  if (stmt.type === 'ExportNamedDeclaration') {
    if (stmt.declaration?.type === 'VariableDeclaration') {
      decl = stmt.declaration
    }
  } else if (stmt.type === 'VariableDeclaration') {
    decl = stmt
  }
  if (decl === undefined || decl.kind !== 'const') return undefined
  return decl.declarations
}

function isExcludedInitializer(declarator: VariableDeclarator): boolean {
  const init = declarator.init
  // No initializer means `declare const` — an ambient type declaration, not a value.
  if (init === null || init === undefined) return true
  return (
    init.type === 'ObjectExpression' ||
    init.type === 'NewExpression' ||
    init.type === 'ArrowFunctionExpression' ||
    init.type === 'FunctionExpression' ||
    init.type === 'ClassExpression' ||
    init.type === 'CallExpression'
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
