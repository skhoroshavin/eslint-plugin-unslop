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

const BANNED_CHARS = new Map([
  ['\u201C', 'left double quotation mark'],
  ['\u201D', 'right double quotation mark'],
  ['\u2018', 'left single quotation mark'],
  ['\u2019', 'right single quotation mark'],
  ['\u00A0', 'non-breaking space'],
  ['\u202F', 'narrow no-break space'],
  ['\u2007', 'figure space'],
  ['\u2008', 'punctuation space'],
  ['\u2009', 'thin space'],
  ['\u200A', 'hair space'],
  ['\u200B', 'zero-width space'],
  ['\u2002', 'en space'],
  ['\u2003', 'em space'],
  ['\u205F', 'medium mathematical space'],
  ['\u3000', 'ideographic space'],
  ['\uFEFF', 'zero-width no-break space'],
  ['\u2013', 'en dash'],
  ['\u2014', 'em dash'],
  ['\u2026', 'horizontal ellipsis'],
])

const BANNED_CHARS_RE = new RegExp([...BANNED_CHARS.keys()].join('|'))

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

// Map of banned characters to their ASCII replacements
const CHAR_REPLACEMENTS = new Map([
  ['\u201C', '"'], // left double quotation mark → "
  ['\u201D', '"'], // right double quotation mark → "
  ['\u2018', "'"], // left single quotation mark → '
  ['\u2019', "'"], // right single quotation mark → '
  ['\u00A0', ' '], // non-breaking space → space
  ['\u202F', ' '], // narrow no-break space → space
  ['\u2007', ' '], // figure space → space
  ['\u2008', ' '], // punctuation space → space
  ['\u2009', ' '], // thin space → space
  ['\u200A', ' '], // hair space → space
  ['\u200B', ''], // zero-width space → (removed)
  ['\u2002', ' '], // en space → space
  ['\u2003', ' '], // em space → space
  ['\u205F', ' '], // medium mathematical space → space
  ['\u3000', ' '], // ideographic space → space
  ['\uFEFF', ''], // zero-width no-break space/BOM → (removed)
  ['\u2013', '-'], // en dash → -
  ['\u2014', '-'], // em dash → -
  ['\u2026', '...'], // horizontal ellipsis → ...
])
