import { test } from 'vitest'
import rule from './no-special-unicode.js'
import { ruleTester } from '../utils/test-fixtures.js'

test('flags banned unicode punctuation and allows ASCII', () => {
  ruleTester.run('no-special-unicode', rule, {
    valid: [{ code: 'const value = "plain ascii text";' }],
    invalid: [
      {
        code: 'const value = "a — b";',
        errors: [{ messageId: 'bannedCharacter' }],
      },
    ],
  })
})
