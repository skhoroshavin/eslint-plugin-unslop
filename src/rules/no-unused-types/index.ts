import type { Rule } from 'eslint'

import type { Program } from 'estree'

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
      description: 'Disallow exported type aliases and interfaces with zero project-wide uses',
      recommended: false,
    },
    schema: [],
    messages: {
      configurationError: 'Configuration error: {{details}}',
      zeroUses: 'type "{{name}}" has no real uses across the project; remove it',
    },
  },
  create(context) {
    const filename = context.filename

    return {
      'Program:exit'(node: Program) {
        const exportedTypeNames = collectExportedTypeNames(node)
        if (filename.length === 0 || exportedTypeNames.size === 0) return

        const projectContext = getRequiredTypeScriptProjectContext(filename)
        if (projectContext.kind === 'context-error') {
          context.report({
            node,
            messageId: 'configurationError',
            data: {
              details: formatProjectContextError(projectContext.error),
            },
          })
          return
        }

        const tsContext = projectContext.projectContext
        for (const name of exportedTypeNames) {
          checkType(name, filename, tsContext, context)
        }
      },
    }
  },
} satisfies Rule.RuleModule

function collectExportedTypeNames(program: Program): Set<string> {
  const names = new Set<string>()
  for (const stmt of program.body) {
    const name = getExportedTypeName(stmt)
    if (name !== undefined) names.add(name)
  }
  return names
}

function getExportedTypeName(stmt: Program['body'][number]): string | undefined {
  if (stmt.type !== 'ExportNamedDeclaration') return undefined
  const decl = stmt.declaration
  if (decl === null || decl === undefined) return undefined
  // eslint-disable-next-line no-restricted-syntax -- TS-specific AST node types extend ESTree
  const declType = (decl as { type: string }).type
  if (declType !== 'TSTypeAliasDeclaration' && declType !== 'TSInterfaceDeclaration')
    return undefined
  // eslint-disable-next-line no-restricted-syntax
  const id = (decl as { id?: { name: string } | null }).id
  return id !== null && id !== undefined ? id.name : undefined
}

function checkType(
  name: string,
  filename: string,
  tsContext: ProjectContext,
  context: Rule.RuleContext,
): void {
  const sourceFile = findTsSourceFile(tsContext.program, filename)
  if (sourceFile === undefined) return

  const targetSymbol = findTypeDeclarationSymbol(sourceFile, name, tsContext.checker)
  if (targetSymbol === undefined) return

  const count = countProjectWideUses(targetSymbol, tsContext.checker, tsContext.program)
  if (count > 0) return

  const decl = targetSymbol.declarations?.[0]
  if (decl === undefined) return

  context.report({
    node: context.sourceCode.ast,
    loc: {
      start: {
        line: ts.getLineAndCharacterOfPosition(sourceFile, decl.getStart(sourceFile)).line + 1,
        column: ts.getLineAndCharacterOfPosition(sourceFile, decl.getStart(sourceFile)).character,
      },
      end: {
        line: ts.getLineAndCharacterOfPosition(sourceFile, decl.getEnd()).line + 1,
        column: ts.getLineAndCharacterOfPosition(sourceFile, decl.getEnd()).character,
      },
    },
    messageId: 'zeroUses',
    data: { name },
  })
}

function findTypeDeclarationSymbol(
  sourceFile: ts.SourceFile,
  name: string,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  for (const stmt of sourceFile.statements) {
    const decl = getTypedDeclaration(stmt)
    if (decl === undefined) continue
    if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue
    const sym = checker.getSymbolAtLocation(decl.name)
    if (sym !== undefined) return sym
  }
  return undefined
}

function getTypedDeclaration(
  stmt: ts.Statement,
): ts.TypeAliasDeclaration | ts.InterfaceDeclaration | undefined {
  if (ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) {
    return stmt
  }
  return undefined
}
