import type { Rule } from 'eslint'
import type { Literal, TemplateLiteral } from 'estree'
import { createStringLiteralListener } from '../../utils/string-literal-listener.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow special unicode punctuation and whitespace in strings',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      bannedCharacter: 'String contains {{name}} (U+{{code}}). Use the ASCII equivalent.',
    },
  },
  create(context: Rule.RuleContext) {
    return createStringLiteralListener(false, (node, text) => {
      if (!BANNED_CHARS_RE.test(text)) {
        return
      }

      for (const [char, name] of BANNED_CHARS) {
        if (!text.includes(char)) {
          continue
        }

        const code = char.codePointAt(0) ?? 0

        context.report({
          node,
          messageId: 'bannedCharacter',
          data: {
            name,
            code: code.toString(16).toUpperCase().padStart(4, '0'),
          },
          fix(fixer) {
            const fixedText = computeFixedText(text, node)
            if (!fixedText) return null
            return fixer.replaceText(node, fixedText)
          },
        })
      }
    })
  },
} satisfies Rule.RuleModule

const CHAR_RULES = [
  { char: '\u201C', name: 'left double quotation mark', replacement: '"' },
  { char: '\u201D', name: 'right double quotation mark', replacement: '"' },
  { char: '\u2018', name: 'left single quotation mark', replacement: "'" },
  { char: '\u2019', name: 'right single quotation mark', replacement: "'" },
  { char: '\u00A0', name: 'non-breaking space', replacement: ' ' },
  { char: '\u202F', name: 'narrow no-break space', replacement: ' ' },
  { char: '\u2007', name: 'figure space', replacement: ' ' },
  { char: '\u2008', name: 'punctuation space', replacement: ' ' },
  { char: '\u2009', name: 'thin space', replacement: ' ' },
  { char: '\u200A', name: 'hair space', replacement: ' ' },
  { char: '\u200B', name: 'zero-width space', replacement: '' },
  { char: '\u2002', name: 'en space', replacement: ' ' },
  { char: '\u2003', name: 'em space', replacement: ' ' },
  { char: '\u205F', name: 'medium mathematical space', replacement: ' ' },
  { char: '\u3000', name: 'ideographic space', replacement: ' ' },
  { char: '\uFEFF', name: 'zero-width no-break space', replacement: '' },
  { char: '\u2013', name: 'en dash', replacement: '-' },
  { char: '\u2014', name: 'em dash', replacement: '-' },
  { char: '\u2026', name: 'horizontal ellipsis', replacement: '...' },
]

const BANNED_CHARS = new Map(CHAR_RULES.map(({ char, name }) => [char, name]))
const BANNED_CHARS_RE = new RegExp(CHAR_RULES.map(({ char }) => char).join('|'))

function computeFixedText(text: string, node: Literal | TemplateLiteral): string | null {
  const { content, wrapper } = extractContent(text, node)
  if (!content) return null

  const wrapperQuote = wrapper === '`' ? null : wrapper
  const result = applyReplacements(content, wrapperQuote)

  if (!result) return null
  return wrapper + result + wrapper
}

function applyReplacements(content: string, wrapperQuote: string | null): string | null {
  let result = content
  let madeReplacement = false

  for (const [char, replacement] of CHAR_REPLACEMENTS) {
    if (!content.includes(char)) continue
    if (isUnsafeReplacement(wrapperQuote, replacement)) continue

    madeReplacement = true
    result = result.split(char).join(replacement)
  }

  return madeReplacement ? result : null
}

const CHAR_REPLACEMENTS = new Map(CHAR_RULES.map(({ char, replacement }) => [char, replacement]))

function isUnsafeReplacement(wrapperQuote: string | null, replacement: string): boolean {
  if (!wrapperQuote) return false
  if (wrapperQuote === '"' && replacement.includes('"')) return true
  if (wrapperQuote === "'" && replacement.includes("'")) return true
  return false
}

function extractContent(
  text: string,
  node: Literal | TemplateLiteral,
): { content: string | null; wrapper: string } {
  if (node.type === 'Literal' && typeof node.value === 'string' && typeof node.raw === 'string') {
    const quote = node.raw[0]
    if (quote === '"' || quote === "'") {
      return { content: node.raw.slice(1, -1), wrapper: quote }
    }
    return { content: null, wrapper: '' }
  }

  if (node.type === 'TemplateLiteral') {
    return { content: text, wrapper: '`' }
  }

  return { content: null, wrapper: '' }
}
