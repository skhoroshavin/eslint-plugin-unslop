import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: no-unicode-escape/spec.md

scenario('literal unicode character is allowed without escape', rule, {
  code: 'const value = "—";',
})

scenario('basic ASCII escape is replaced with literal character', rule, {
  code: 'const x = "\\u0041";',
  errors: [{ messageId: 'preferLiteral' }],
  output: 'const x = "A";',
})

scenario('basic ASCII escape in single-quoted string preserves quote style', rule, {
  code: "const x = '\\u0041';",
  errors: [{ messageId: 'preferLiteral' }],
  output: "const x = 'A';",
})

scenario('multiple escapes in one string are all replaced', rule, {
  code: 'const x = "\\u0041\\u0042";',
  errors: [{ messageId: 'preferLiteral' }],
  output: 'const x = "AB";',
})

scenario('escape in template literal is replaced', rule, {
  code: 'const x = `\\u0041`;',
  errors: [{ messageId: 'preferLiteral' }],
  output: 'const x = `A`;',
})

scenario('quote delimiter escape is reported but not auto-fixed', rule, {
  code: 'const x = "\\u0022";',
  errors: [{ messageId: 'preferLiteral' }],
  output: null,
})

scenario('backslash escape is reported but not auto-fixed', rule, {
  code: 'const x = "\\u005C";',
  errors: [{ messageId: 'preferLiteral' }],
  output: null,
})

scenario('newline control character escape is reported but not auto-fixed', rule, {
  code: 'const x = "\\u000A";',
  errors: [{ messageId: 'preferLiteral' }],
  output: null,
})

scenario('tab control character escape is reported but not auto-fixed', rule, {
  code: 'const x = "\\u0009";',
  errors: [{ messageId: 'preferLiteral' }],
  output: null,
})

scenario('mixed safe and unsafe escapes produce no partial fix', rule, {
  code: 'const x = "\\u0041\\u0022\\u0042";',
  errors: [{ messageId: 'preferLiteral' }],
  output: null,
})
