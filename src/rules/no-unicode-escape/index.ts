import type { Rule } from 'eslint'
import type { Node } from 'estree'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow Unicode escape sequences when literal characters can be used',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferLiteral: 'Use the literal character instead of the Unicode escape sequence.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (node.type !== 'Literal') return
        if (typeof node.value !== 'string') return
        const raw = context.sourceCode.getText(node)
        ESCAPE_RE.lastIndex = 0
        if (!ESCAPE_RE.test(raw)) return

        const wrapper = raw[0]
        const fixed = tryFix(raw, wrapper)
        reportIfNeeded(context, node, fixed)
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const raw = context.sourceCode.getText(quasi)
          ESCAPE_RE.lastIndex = 0
          if (!ESCAPE_RE.test(raw)) continue

          const fixed = tryFix(raw, '`')
          reportIfNeeded(context, quasi, fixed)
        }
      },
    }
  },
}

function reportIfNeeded(context: Rule.RuleContext, node: Node, fixed: string | null): void {
  const range = node.range
  context.report({
    node,
    messageId: 'preferLiteral',
    fix: fixed && range ? (fixer) => fixer.replaceTextRange(range, fixed) : null,
  })
}

function tryFix(raw: string, wrapper: string): string | null {
  ESCAPE_RE.lastIndex = 0
  const matches: EscapeMatch[] = []
  let m: RegExpExecArray | null
  while ((m = ESCAPE_RE.exec(raw)) !== null) {
    matches.push({
      index: m.index,
      len: m[0].length,
      cp: parseInt(m[1], 16),
    })
  }
  if (matches.length === 0) return null
  if (matches.some((e) => isUnsafe(e.cp, wrapper))) return null

  return replaceMatches(raw, matches)
}

function replaceMatches(raw: string, matches: EscapeMatch[]): string {
  let result = raw
  for (let i = matches.length - 1; i >= 0; i--) {
    const entry = matches[i]
    result =
      result.slice(0, entry.index) +
      String.fromCodePoint(entry.cp) +
      result.slice(entry.index + entry.len)
  }
  return result
}

interface EscapeMatch {
  index: number
  len: number
  cp: number
}

const ESCAPE_RE = /\\u([0-9A-Fa-f]{4})/g

const ALWAYS_UNSAFE = new Set([0x5c])

const WRAPPER_UNSAFE: Record<string, number> = {
  '"': 0x22,
  "'": 0x27,
  '`': 0x60,
}

function isUnsafe(codePoint: number, wrapper: string): boolean {
  if (codePoint < 0x20) return true
  if (ALWAYS_UNSAFE.has(codePoint)) return true
  return codePoint === WRAPPER_UNSAFE[wrapper]
}

export default rule
