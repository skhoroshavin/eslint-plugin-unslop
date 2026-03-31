import { test } from 'vitest'
import rule from './no-unicode-escape.js'
import { ruleTester } from '../utils/test-fixtures.js'

test('flags unicode escapes and allows literal characters', () => {
  ruleTester.run('no-unicode-escape', rule, {
    valid: [{ code: 'const value = "—";' }],
    invalid: [
      {
        code: 'const value = "\\u2014";',
        errors: [{ messageId: 'preferLiteral' }],
      },
    ],
  })
})
