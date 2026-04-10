import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration } from 'estree'

import {
  getDeclarationNamesFromExport,
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  readArchitecturePolicy,
} from '../../utils/index.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce symbol contracts for module public entrypoints',
      recommended: false,
    },
    schema: [],
    messages: {
      exportAllForbidden: 'Export denied: export * is not allowed.',
      symbolDenied:
        'Export denied: symbol "{{symbol}}" does not match configured exports patterns.',
      invalidExportRegex: 'Configuration error: invalid exports pattern "{{pattern}}"',
    },
  },
  create(context) {
    const filename = context.filename
    if (!filename) return {}

    const state = buildRuleState(context, filename)
    if (state?.invalidPattern !== undefined) {
      const root = context.getSourceCode().ast
      context.report({
        node: root,
        messageId: 'invalidExportRegex',
        data: { pattern: state.invalidPattern },
      })
      return {}
    }

    return {
      ExportNamedDeclaration(node) {
        checkNamedExport(context, node, state?.patterns)
      },
      ExportAllDeclaration(node) {
        // Always reject export * from ... in all files per spec
        checkExportAll(context, node)
      },
      ExportDefaultDeclaration(node) {
        if (state?.patterns === undefined) return
        checkDefaultExport(context, node, state.patterns)
      },
    }
  },
} satisfies Rule.RuleModule

function buildRuleState(context: Rule.RuleContext, filename: string): RuleState | undefined {
  const policy = readArchitecturePolicy(context)
  if (policy === undefined) return undefined
  if (!isPublicEntrypoint(filename)) return undefined

  const moduleMatch = matchFileToArchitectureModule(filename, policy)
  if (moduleMatch === undefined) return undefined

  const hasExportContract = moduleMatch.policy.exports.length > 0
  if (!hasExportContract) return {}

  const built = buildPatterns(moduleMatch.policy.exports)
  if (built.invalid !== undefined) {
    return { invalidPattern: built.invalid }
  }
  return { patterns: built.patterns }
}

function buildPatterns(values: string[]): { patterns: RegExp[]; invalid?: string } {
  const patterns: RegExp[] = []
  for (const value of values) {
    try {
      patterns.push(new RegExp(value))
    } catch {
      return { patterns: [], invalid: String(value) }
    }
  }
  return { patterns }
}

function checkNamedExport(
  context: Rule.RuleContext,
  node: ExportNamedDeclaration,
  patterns: RegExp[] | undefined,
): void {
  if (node.source !== null && node.specifiers.length === 0) {
    context.report({ node, messageId: 'exportAllForbidden' })
    return
  }
  if (patterns === undefined) return
  for (const specifier of node.specifiers) {
    if (specifier.exported.type !== 'Identifier') continue
    if (matchesAnyPattern(specifier.exported.name, patterns)) continue
    context.report({
      node: specifier,
      messageId: 'symbolDenied',
      data: { symbol: specifier.exported.name },
    })
  }
  reportDeclarationExportNames(context, node, patterns)
}

function reportDeclarationExportNames(
  context: Rule.RuleContext,
  node: ExportNamedDeclaration,
  patterns: RegExp[],
): void {
  const declaration = node.declaration
  if (declaration === null || declaration === undefined) return
  const names = getDeclarationNamesFromExport(declaration)
  for (const name of names) {
    if (matchesAnyPattern(name, patterns)) continue
    context.report({ node, messageId: 'symbolDenied', data: { symbol: name } })
  }
}

function checkDefaultExport(
  context: Rule.RuleContext,
  node: ExportDefaultDeclaration,
  patterns: RegExp[],
): void {
  if (matchesAnyPattern('default', patterns)) return
  context.report({ node, messageId: 'symbolDenied', data: { symbol: 'default' } })
}

function checkExportAll(context: Rule.RuleContext, node: ExportAllDeclaration): void {
  context.report({ node, messageId: 'exportAllForbidden' })
}

function matchesAnyPattern(symbol: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(symbol))
}

interface RuleState {
  patterns?: RegExp[]
  invalidPattern?: string
}
