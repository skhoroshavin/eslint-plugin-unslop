import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: special-unicode-autofix/spec.md

scenario('plain ASCII string is allowed', rule, {
  code: 'const value = "plain ascii text";',
})

scenario('plain single-quoted ASCII string is allowed', rule, {
  code: "const value = 'plain ascii text';",
})

scenario('plain template literal is allowed', rule, {
  code: 'const value = `plain ascii text`;',
})

// Smart quotes

scenario(
  'left double quotation mark in template literal is replaced with straight double quote',
  rule,
  {
    code: 'const value = `He said \u201Chello\u201D`;',
    errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
    output: 'const value = `He said "hello"`;',
  },
)

scenario(
  'right single quotation mark in template literal is replaced with straight apostrophe',
  rule,
  {
    code: 'const value = `It\u2019s a nice day`;',
    errors: [{ messageId: 'bannedCharacter' }],
    output: "const value = `It's a nice day`;",
  },
)

scenario(
  'left single quotation mark in template literal is replaced with straight apostrophe',
  rule,
  {
    code: 'const value = `She said \u2018hi\u2019`;',
    errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
    output: "const value = `She said 'hi'`;",
  },
)

scenario('smart double quotes inside single-quoted string are replaced', rule, {
  code: "const value = 'He said \u201Chello\u201D';",
  errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
  output: 'const value = \'He said "hello"\';',
})

scenario('smart single quote inside double-quoted string is replaced', rule, {
  code: 'const value = "It\u2019s a nice day";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "It\'s a nice day";',
})

scenario('smart double quotes inside double-quoted string are reported but not auto-fixed', rule, {
  code: 'const value = "He said \u201Chello\u201D";',
  errors: [{ messageId: 'bannedCharacter' }, { messageId: 'bannedCharacter' }],
  output: null,
})

scenario('smart single quote inside single-quoted string is reported but not auto-fixed', rule, {
  code: "const value = 'It\u2019s a nice day';",
  errors: [{ messageId: 'bannedCharacter' }],
  output: null,
})

// Special spaces

scenario('non-breaking space is replaced with regular space', rule, {
  code: 'const value = "hello\u00A0world";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "hello world";',
})

scenario('narrow no-break space is replaced with regular space', rule, {
  code: 'const value = "hello\u202Fworld";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "hello world";',
})

scenario('thin space is replaced with regular space', rule, {
  code: 'const value = "hello\u2009world";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "hello world";',
})

// Zero-width characters

scenario('zero-width space is removed entirely by autofix', rule, {
  code: 'const value = "hello\u200Bworld";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "helloworld";',
})

scenario('zero-width no-break space (BOM) is removed entirely by autofix', rule, {
  code: 'const value = "hello\uFEFFworld";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "helloworld";',
})

// Dashes

scenario('en dash is replaced with hyphen', rule, {
  code: 'const value = "a \u2013 b";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "a - b";',
})

scenario('em dash is replaced with hyphen', rule, {
  code: 'const value = "a \u2014 b";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "a - b";',
})

// Ellipsis

scenario('ellipsis character is replaced with three dots', rule, {
  code: 'const value = "wait\u2026";',
  errors: [{ messageId: 'bannedCharacter' }],
  output: 'const value = "wait...";',
})

// Multiple banned characters

scenario('multiple banned characters in a string are all fixed in one pass', rule, {
  code: 'const value = `\u201Chello\u201D \u2014 it\u2019s\u2026`;',
  errors: [
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
  ],
  output: 'const value = `"hello" - it\'s...`;',
})

scenario('safe chars are fixed and unsafe quote chars are left alone in one pass', rule, {
  code: 'const value = "It\u2019s a nice day \u2014 said \u201Csomeone\u201D";',
  errors: [
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
    { messageId: 'bannedCharacter' },
  ],
  output: 'const value = "It\'s a nice day - said \u201Csomeone\u201D";',
})
