import type { Rule } from 'eslint'
import type { ImportDeclaration } from 'estree'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow imports that reach too deep into a folder',
      recommended: true,
    },
    schema: [
      {
        type: 'object',
        properties: {
          sourceRoot: { type: 'string' },
          maxDepth: { type: 'number' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooDeep: 'Import reaches too deep. Prefer importing from a higher-level module.',
    },
  },
  create(context) {
    const filename = context.filename
    if (!filename) return {}

    return {
      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string') return

        if (source.startsWith('@/')) {
          checkAliasImport(context, node, source, filename)
        } else if (source.startsWith('./')) {
          checkRelativeImport(context, node, source)
        }
      },
    }
  },
}

function checkAliasImport(
  context: Rule.RuleContext,
  node: ImportDeclaration,
  source: string,
  filename: string,
): void {
  const parts = source.slice(2).split('/')
  if (parts.length < 2) return

  const topLevel = parts[0]
  const depth = parts.length - 2

  if (depth <= MAX_DEPTH) return

  const posix = filename.split(/[\\/]/).filter(Boolean)
  if (!posix.includes(topLevel)) return

  context.report({ node, messageId: 'tooDeep' })
}

function checkRelativeImport(
  context: Rule.RuleContext,
  node: ImportDeclaration,
  source: string,
): void {
  const parts = source.slice(2).split('/')
  const depth = parts.length - 1

  if (depth > MAX_DEPTH) {
    context.report({ node, messageId: 'tooDeep' })
  }
}

const MAX_DEPTH = 1

export default rule
