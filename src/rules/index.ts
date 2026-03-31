import type { Rule } from 'eslint'
import noSpecialUnicode from './no-special-unicode.js'
import noUnicodeEscape from './no-unicode-escape.js'
import noDeepImports from './no-deep-imports.js'
import noFalseSharing from './no-false-sharing.js'
import readFriendlyOrder from './read-friendly-order.js'

export default {
  'no-special-unicode': noSpecialUnicode,
  'no-unicode-escape': noUnicodeEscape,
  'no-deep-imports': noDeepImports,
  'no-false-sharing': noFalseSharing,
  'read-friendly-order': readFriendlyOrder,
} satisfies Record<string, Rule.RuleModule>
