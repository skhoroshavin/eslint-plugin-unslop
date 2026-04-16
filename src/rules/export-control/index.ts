import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportDefaultDeclaration, ExportNamedDeclaration } from 'estree'

import node_path from 'node:path'

import {
  createConfigurationErrorListeners,
  formatProjectContextError,
  getArchitectureRuleState,
  getDeclarationNamesFromExport,
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
      configurationError: 'Configuration error: {{details}}',
      exportAllForbidden: 'Export denied: export * is not allowed.',
      symbolDenied:
        'Export denied: symbol "{{symbol}}" does not match configured exports patterns.',
      invalidExportRegex: 'Configuration error: invalid exports pattern "{{pattern}}"',
    },
  },
  create(context) {
    const state = buildRuleState(context)
    if (state.kind === 'config-error') {
      return createConfigurationErrorListeners(context, state.details)
    }
    if (state.kind === 'context-error') {
      return createConfigurationErrorListeners(context, formatProjectContextError(state.error))
    }
    if (state.kind === 'invalid') {
      const root = context.getSourceCode().ast
      context.report({
        node: root,
        messageId: 'invalidExportRegex',
        data: { pattern: state.invalidPattern },
      })
      return {}
    }

    if (state.kind !== 'active') {
      return {
        ExportAllDeclaration(node) {
          checkExportAll(context, node)
        },
      }
    }

    return {
      ExportNamedDeclaration(node) {
        checkNamedExport(context, node, state.patterns)
      },
      ExportAllDeclaration(node) {
        // Always reject export * from ... in all files per spec
        checkExportAll(context, node)
      },
      ExportDefaultDeclaration(node) {
        checkDefaultExport(context, node, state.patterns)
      },
    }
  },
} satisfies Rule.RuleModule

function buildRuleState(context: Rule.RuleContext): RuleState {
  const state = getArchitectureRuleState(context)
  if (state.kind === 'config-error') {
    return { kind: 'config-error', details: state.details }
  }
  if (state.kind === 'context-error') {
    return { kind: 'context-error', error: state.error }
  }
  if (state.kind !== 'active') return { kind: 'inactive' }
  if (!isEntrypointFile(state.filename, state.moduleMatch.policy.entrypoints))
    return { kind: 'inactive' }
  if (state.moduleMatch.policy.exports.length === 0) return { kind: 'inactive' }

  const built = buildPatterns(state.moduleMatch.policy.exports)
  if (built.invalid !== undefined) {
    return { kind: 'invalid', invalidPattern: built.invalid }
  }
  return { kind: 'active', patterns: built.patterns }
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
  patterns: RegExp[],
): void {
  if (node.source !== null && node.specifiers.length === 0) {
    context.report({ node, messageId: 'exportAllForbidden' })
    return
  }
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
  if (declaration === null) return
  const names = getDeclarationNamesFromExport(declaration)
  for (const name of names) {
    reportSymbolIfDenied(context, node, name, patterns)
  }
}

function checkDefaultExport(
  context: Rule.RuleContext,
  node: ExportDefaultDeclaration,
  patterns: RegExp[],
): void {
  reportSymbolIfDenied(context, node, 'default', patterns)
}

function reportSymbolIfDenied(
  context: Rule.RuleContext,
  node: ExportNamedDeclaration | ExportDefaultDeclaration,
  symbol: string,
  patterns: RegExp[],
): void {
  if (matchesAnyPattern(symbol, patterns)) return
  context.report({ node, messageId: 'symbolDenied', data: { symbol } })
}

function checkExportAll(context: Rule.RuleContext, node: ExportAllDeclaration): void {
  context.report({ node, messageId: 'exportAllForbidden' })
}

function matchesAnyPattern(symbol: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(symbol))
}

function isEntrypointFile(filePath: string, entrypoints: string[]): boolean {
  return entrypoints.includes(node_path.basename(filePath))
}

type RuleState =
  | { kind: 'inactive' }
  | { kind: 'config-error'; details: string }
  | {
      kind: 'context-error'
      error: Extract<
        ReturnType<typeof getArchitectureRuleState>,
        { kind: 'context-error' }
      >['error']
    }
  | { kind: 'invalid'; invalidPattern: string }
  | { kind: 'active'; patterns: RegExp[] }
