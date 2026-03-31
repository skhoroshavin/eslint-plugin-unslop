import type { Rule } from 'eslint'
import { createStringLiteralListener } from '../utils/string-literal-listener.js'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer literal unicode characters over \\uXXXX escape sequences',
      recommended: true,
    },
    schema: [],
    messages: {
      preferLiteral: 'Use the actual character instead of a \\uXXXX escape sequence.',
    },
  },
  create(context: Rule.RuleContext) {
    return createStringLiteralListener(true, (node, text) => {
      if (UNICODE_ESCAPE_RE.test(text)) {
        context.report({ node, messageId: 'preferLiteral' })
      }
    })
  },
} satisfies Rule.RuleModule

const UNICODE_ESCAPE_RE = /\\u[0-9a-fA-F]{4}/
