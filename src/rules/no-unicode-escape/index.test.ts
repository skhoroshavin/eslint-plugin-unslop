import { test } from 'vitest'
import rule from './index.js'
import { ruleTester } from '../../utils/test-fixtures.js'

test('flags unicode escapes and allows literal characters', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [{ code: 'const value = "—";' }],
    invalid: [
      {
        code: 'const value = "\\u2014";',
        errors: [{ messageId: 'preferLiteral' }],
        output: 'const value = "—";',
      },
    ],
  })
})

test('autofix: basic ASCII escape with double quotes', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: 'const x = "\\u0041";',
        errors: [{ messageId: 'preferLiteral' }],
        output: 'const x = "A";',
      },
    ],
  })
})

test('autofix: basic ASCII escape with single quotes', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: "const x = '\\u0041';",
        errors: [{ messageId: 'preferLiteral' }],
        output: "const x = 'A';",
      },
    ],
  })
})

test('autofix: multiple escapes', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: 'const x = "\\u0041\\u0042";',
        errors: [{ messageId: 'preferLiteral' }],
        output: 'const x = "AB";',
      },
    ],
  })
})

test('autofix: template literal', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: 'const x = `\\u0041`;',
        errors: [{ messageId: 'preferLiteral' }],
        output: 'const x = `A`;',
      },
    ],
  })
})

test('no autofix: unsafe character - quote delimiter', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: 'const x = "\\u0022";',
        errors: [{ messageId: 'preferLiteral' }],
      },
    ],
  })
})

test('no autofix: unsafe character - backslash', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: 'const x = "\\u005C";',
        errors: [{ messageId: 'preferLiteral' }],
      },
    ],
  })
})

test('no autofix: mixed safe and unsafe escapes', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [],
    invalid: [
      {
        code: 'const x = "\\u0041\\u0022\\u0042";',
        errors: [{ messageId: 'preferLiteral' }],
      },
    ],
  })
})
