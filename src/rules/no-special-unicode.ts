import type { Rule } from 'eslint'
import { createStringLiteralListener } from '../utils/string-literal-listener.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow special unicode punctuation and whitespace in strings',
      recommended: true,
    },
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
