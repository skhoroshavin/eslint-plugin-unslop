import type { Rule } from 'eslint'
import type {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Pattern,
  VariableDeclaration,
} from 'estree'
import {
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  readArchitecturePolicy,
} from '../../utils/architecture-policy.js'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce symbol contracts for module public entrypoints',
      recommended: false,
    },
    schema: [],
    messages: {
      exportAllForbidden:
        'Export denied: export * is not allowed when exports policy is configured.',
      symbolDenied:
        'Export denied: symbol "{{symbol}}" does not match configured exports patterns.',
      invalidExportRegex: 'Configuration error: invalid exports pattern "{{pattern}}"',
    },
  },
  create(context) {
    const filename = context.filename
    if (!filename) return {}

    const policy = readArchitecturePolicy(context)
    if (policy === undefined) return {}
    if (!isPublicEntrypoint(filename)) return {}

    const moduleMatch = matchFileToArchitectureModule(filename, policy)
    if (moduleMatch === undefined) return {}
    if (moduleMatch.policy.exports.length === 0) return {}

    const built = buildPatterns(moduleMatch.policy.exports)
    if (built.invalid !== undefined) {
      const root = context.getSourceCode().ast
      context.report({
        node: root,
        messageId: 'invalidExportRegex',
        data: { pattern: built.invalid },
      })
      return {}
    }
    const patterns = built.patterns

    return {
      ExportNamedDeclaration(node) {
        checkNamedExport(context, node, patterns)
      },
      ExportAllDeclaration(node) {
        checkExportAll(context, node)
      },
      ExportDefaultDeclaration(node) {
        checkDefaultExport(context, node, patterns)
      },
    }
  },
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
  if (declaration === null || declaration === undefined) return
  const names = getDeclarationNames(declaration)
  for (const name of names) {
    if (matchesAnyPattern(name, patterns)) continue
    context.report({ node, messageId: 'symbolDenied', data: { symbol: name } })
  }
}

function getDeclarationNames(declaration: unknown): string[] {
  if (isVariableDeclaration(declaration)) {
    return declaration.declarations.flatMap((entry) => getPatternNames(entry.id))
  }
  if (hasStringName(declaration)) {
    return [declaration.id.name]
  }
  return []
}

function isVariableDeclaration(value: unknown): value is VariableDeclaration {
  if (typeof value !== 'object' || value === null) return false
  return 'type' in value && value.type === 'VariableDeclaration'
}

function getPatternNames(pattern: Pattern): string[] {
  if (pattern.type === 'Identifier') return [pattern.name]
  return []
}

function hasStringName(value: unknown): value is { id: { name: string } } {
  if (typeof value !== 'object' || value === null) return false
  if (!('id' in value)) return false
  const id = value.id
  if (typeof id !== 'object' || id === null) return false
  if (!('name' in id)) return false
  return typeof id.name === 'string'
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

export default rule
