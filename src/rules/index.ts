import type { Rule } from 'eslint'
import noSpecialUnicode from './no-special-unicode/index.js'
import noUnicodeEscape from './no-unicode-escape/index.js'
import noDeepImports from './no-deep-imports/index.js'
import noFalseSharing from './no-false-sharing/index.js'
import readFriendlyOrder from './read-friendly-order/index.js'

export default {
  'no-special-unicode': noSpecialUnicode,
  'no-unicode-escape': noUnicodeEscape,
  'no-deep-imports': noDeepImports,
  'no-false-sharing': noFalseSharing,
  'read-friendly-order': readFriendlyOrder,
} satisfies Record<string, Rule.RuleModule>
