import type { Rule } from 'eslint'
import noSpecialUnicode from './no-special-unicode/index.js'
import noUnicodeEscape from './no-unicode-escape/index.js'
import noFalseSharing from './no-false-sharing/index.js'
import readFriendlyOrder from './read-friendly-order/index.js'
import importControl from './import-control/index.js'
import exportControl from './export-control/index.js'
import noSingleUseConstants from './no-single-use-constants/index.js'

export default {
  'no-special-unicode': noSpecialUnicode,
  'no-unicode-escape': noUnicodeEscape,
  'no-false-sharing': noFalseSharing,
  'read-friendly-order': readFriendlyOrder,
  'import-control': importControl,
  'export-control': exportControl,
  'no-single-use-constants': noSingleUseConstants,
} satisfies Record<string, Rule.RuleModule>
