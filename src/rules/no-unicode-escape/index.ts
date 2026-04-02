import type { Rule } from 'eslint'
import type { Literal, TemplateLiteral } from 'estree'
import { createStringLiteralListener } from '../../utils/string-literal-listener.js'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer literal unicode characters over \\uXXXX escape sequences',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferLiteral: 'Use the actual character instead of a \\uXXXX escape sequence.',
    },
  },
  create(context: Rule.RuleContext) {
    return createStringLiteralListener(true, (node, text) => {
      if (UNICODE_ESCAPE_RE.test(text)) {
        context.report({
          node,
          messageId: 'preferLiteral',
          fix(fixer) {
            const replacement = computeReplacement(text, node)
            if (!replacement) return null
            return fixer.replaceText(node, replacement)
          },
        })
      }
    })
  },
} satisfies Rule.RuleModule

function computeReplacement(text: string, node: Literal | TemplateLiteral): string | null {
  const { content, wrapper } = extractContentAndWrapper(text, node)
  if (!content) return null

  // Check if all escapes are safe (all-or-nothing strategy)
  if (!allEscapesSafe(content)) return null

  // All escapes are safe, replace them all
  const result = content.replace(UNICODE_ESCAPE_RE, (match) => {
    const hex = match.slice(2)
    const code = Number.parseInt(hex, 16)
    return String.fromCharCode(code)
  })

  return wrapper + result + wrapper
}

function extractContentAndWrapper(
  text: string,
  node: Literal | TemplateLiteral,
): { content: string | null; wrapper: string } {
  // For string literals, use node.raw directly to get the quoted content
  if (node.type === 'Literal' && typeof node.value === 'string' && typeof node.raw === 'string') {
    const quote = node.raw[0]
    if (quote === '"' || quote === "'") {
      return { content: node.raw.slice(1, -1), wrapper: quote }
    }
    return { content: null, wrapper: '' }
  }

  // For template literals, the text is already the raw content without outer backticks
  if (node.type === 'TemplateLiteral') {
    return { content: text, wrapper: '`' }
  }

  return { content: null, wrapper: '' }
}

function allEscapesSafe(content: string): boolean {
  const escapes = content.match(UNICODE_ESCAPE_RE)
  if (!escapes) return false

  for (const escape of escapes) {
    const hex = escape.slice(2)
    const code = Number.parseInt(hex, 16)
    if (isUnsafeChar(code)) return false
  }

  return true
}

function isUnsafeChar(code: number): boolean {
  // Control characters (0x00-0x1F)
  if (code <= 0x1f) return true
  // Quote delimiters and backslash
  if (code === 0x22 || code === 0x27 || code === 0x5c || code === 0x60) return true
  return false
}

const UNICODE_ESCAPE_RE = /\\u[0-9a-fA-F]{4}/g
