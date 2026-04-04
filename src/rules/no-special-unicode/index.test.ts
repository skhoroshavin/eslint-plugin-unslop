import { test } from 'vitest'
import rule from './index.js'
import { ruleTester } from '../../utils/test-fixtures/index.js'

test('autofixes smart quotes safely', () => {
  ruleTester.run('no-special-unicode', rule, {
    valid: [
      { code: 'const value = "plain ascii text";' },
      { code: "const value = 'plain ascii text';" },
      { code: 'const value = `plain ascii text`;' },
    ],
    invalid: [
      // Smart quotes in template literals (safe to fix)
      {
        code: `const value = \`He said ${LDQ}hello${RDQ}\`;`,
        output: 'const value = `He said "hello"`;',
        errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
      },
      // Smart single quote in template literal
      {
        code: `const value = \`It${RSQ}s a nice day\`;`,
        output: "const value = `It's a nice day`;",
        errors: [{ messageId: 'bannedCharacter' }],
      },
      // Smart double quotes in single-quoted string (safe to fix)
      {
        code: `const value = 'He said ${LDQ}hello${RDQ}';`,
        output: 'const value = \'He said "hello"\';',
        errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
      },
      // Smart single quote in double-quoted string (safe to fix)
      {
        code: `const value = "It${RSQ}s a nice day";`,
        output: 'const value = "It\'s a nice day";',
        errors: [{ messageId: 'bannedCharacter' }],
      },
    ],
  })
})

test('autofixes special characters', () => {
  ruleTester.run('no-special-unicode', rule, {
    valid: [],
    invalid: [
      // Special spaces
      {
        code: `const value = "hello${NBSP}world";`,
        output: 'const value = "hello world";',
        errors: [{ messageId: 'bannedCharacter' }],
      },
      // Dashes
      {
        code: `const value = "a ${ENDASH} b";`,
        output: 'const value = "a - b";',
        errors: [{ messageId: 'bannedCharacter' }],
      },
      {
        code: `const value = "a ${EMDASH} b";`,
        output: 'const value = "a - b";',
        errors: [{ messageId: 'bannedCharacter' }],
      },
      // Ellipsis
      {
        code: `const value = "wait${ELLIPSIS}";`,
        output: 'const value = "wait...";',
        errors: [{ messageId: 'bannedCharacter' }],
      },
    ],
  })
})

test('quote safety - does not autofix when unsafe', () => {
  ruleTester.run('no-special-unicode', rule, {
    valid: [],
    invalid: [
      // Smart double quotes in double-quoted strings NOT auto-fixed
      {
        code: `const value = "He said ${LDQ}hello${RDQ}";`,
        output: null,
        errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
      },
      // Smart single quote in single-quoted string NOT auto-fixed
      {
        code: `const value = 'It${RSQ}s a nice day';`,
        output: null,
        errors: [{ messageId: 'bannedCharacter' }],
      },
    ],
  })
})

test('complex scenarios', () => {
  ruleTester.run('no-special-unicode', rule, {
    valid: [],
    invalid: [
      // Safe chars fixed, unsafe quote chars left alone
      {
        code: `const value = "It${RSQ}s a nice day ${EMDASH} said ${LDQ}someone${RDQ}";`,
        output: 'const value = "It\'s a nice day - said ' + LDQ + 'someone' + RDQ + '";',
        errors: [
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
        ],
      },
      // Multiple different banned characters in template literal
      {
        code: `const value = \`${LDQ}hello${RDQ} ${EMDASH} it${RSQ}s${ELLIPSIS}\`;`,
        output: 'const value = `"hello" - it\'s...`;',
        errors: [
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
          { messageId: 'bannedCharacter' },
        ],
      },
    ],
  })
})

// Test constants for special characters
const LDQ = '“' // left double quotation mark
const RDQ = '”' // right double quotation mark
const RSQ = '’' // right single quotation mark
const NBSP = ' ' // non-breaking space
const ENDASH = '–' // en dash
const EMDASH = '—' // em dash
const ELLIPSIS = '…' // ellipsis
