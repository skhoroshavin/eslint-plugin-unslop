import { test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import rule from './index.js'
import { ruleTester } from '../../utils/test-fixtures/index.js'

test('allows top-level symbols before helpers', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: VALID_CASES,
    invalid: [],
  })
})

test('flags helper declarations placed above top-level consumers', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: [],
    invalid: INVALID_CASES,
  })
})

test('allows symbols consumed by eager global assignments', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: EAGER_EVAL_VALID_CASES,
    invalid: [],
  })
})

test('allows type declarations below top-level type consumers', () => {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: TYPE_VALID_CASES,
    invalid: [],
  })
})

test('flags type declarations placed above top-level type consumers', () => {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: [],
    invalid: TYPE_INVALID_CASES,
  })
})

test('allows cyclic dependencies between helpers', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: CYCLIC_VALID_CASES,
    invalid: [],
  })
})

const VALID_CASES = [
  {
    code: [
      "import value from './value.js'",
      '',
      'export default {',
      '  create() {',
      '    helper()',
      '    return SHARED + value',
      '  },',
      '}',
      '',
      'const SHARED = 1',
      '',
      'function helper() {}',
    ].join('\n'),
  },
  {
    code: [
      "import value from './value.js'",
      '',
      'const exportedValue = buildValue() + value',
      '',
      'export { exportedValue }',
      '',
      'const buildValue = () => 1',
    ].join('\n'),
  },
  {
    code: [
      "import value from './value.js'",
      '',
      'export function A() {',
      '  return 1 + B() + value',
      '}',
      '',
      'export function B() {',
      '  return 1 - C()',
      '}',
      '',
      'function C() {',
      '  return Math.random()',
      '}',
    ].join('\n'),
  },
  {
    code: [
      'const MAX_COUNT = 3',
      '',
      'function read() {',
      '  return 1',
      '}',
      '',
      'export { MAX_COUNT }',
    ].join('\n'),
  },
]

const EAGER_ENTRYPOINT = "if (import.meta.url === 'file:///tmp/run.js') main()"

const EAGER_EVAL_VALID_CASES = [
  {
    code: [
      "import value from './value.js'",
      '',
      'const helper = () => 1',
      '',
      'const total = helper() + value',
      '',
      'export { total }',
    ].join('\n'),
  },
  {
    code: [
      'const buildValue = () => 1',
      '',
      'const cached = buildValue()',
      '',
      'export { cached }',
    ].join('\n'),
  },
  {
    code: [
      'const MAX = 3',
      '',
      'const total = MAX + 1',
      '',
      'function useMax() {',
      '  return MAX',
      '}',
    ].join('\n'),
  },
  {
    code: ['const MAX = 3', '', 'const doubled = MAX * 2', '', 'const tripled = MAX * 3'].join(
      '\n',
    ),
  },
  {
    code: [
      EAGER_ENTRYPOINT,
      '',
      "const BUMP_ARGS = ['dev', 'patch']",
      '',
      'function main() {',
      '  return BUMP_ARGS.length',
      '}',
    ].join('\n'),
  },
  {
    code: [
      'const LIMIT = 3',
      '',
      EAGER_ENTRYPOINT,
      '',
      'function main() {',
      '  return run()',
      '}',
      '',
      'function run() {',
      '  return LIMIT',
      '}',
    ].join('\n'),
  },
]

const INVALID_CASES = [
  {
    code: [
      "import value from './value.js'",
      '',
      'function helper() {}',
      '',
      'export default {',
      '  create() {',
      '    helper()',
      '    return value',
      '  },',
      '}',
    ].join('\n'),
    output: [
      "import value from './value.js'",
      '',
      'export default {',
      '  create() {',
      '    helper()',
      '    return value',
      '  },',
      '}',
      '',
      'function helper() {}',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }],
  },
  {
    code: [
      "import value from './value.js'",
      '',
      'export function B() {',
      '  return 1 - C()',
      '}',
      '',
      'export function A() {',
      '  return 1 + B()',
      '}',
      '',
      'function C() {',
      '  return Math.random() + value',
      '}',
    ].join('\n'),
    output: [
      "import value from './value.js'",
      '',
      'export function A() {',
      '  return 1 + B()',
      '}',
      '',
      'export function B() {',
      '  return 1 - C()',
      '}',
      '',
      'function C() {',
      '  return Math.random() + value',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }],
  },
  {
    code: [
      'const MAX_COUNT = 3',
      '',
      'export function limit() {',
      '  return Math.min(MAX_COUNT, 10)',
      '}',
      '',
      'export { MAX_COUNT }',
    ].join('\n'),
    output: [
      'export function limit() {',
      '  return Math.min(MAX_COUNT, 10)',
      '}',
      '',
      'const MAX_COUNT = 3',
      '',
      'export { MAX_COUNT }',
    ].join('\n'),
    errors: [{ messageId: 'moveConstantBelow' }],
  },
  {
    code: [
      'export const MAX_COUNT = 3',
      '',
      'class Limiter {',
      '  constructor() {',
      '    this.value = MAX_COUNT',
      '  }',
      '',
      '  value = 0',
      '}',
    ].join('\n'),
    output: [
      'class Limiter {',
      '  constructor() {',
      '    this.value = MAX_COUNT',
      '  }',
      '',
      '  value = 0',
      '}',
      '',
      'export const MAX_COUNT = 3',
    ].join('\n'),
    errors: [{ messageId: 'moveConstantBelow' }],
  },
  {
    code: [
      'const INTERNAL_LIMIT = 3',
      '',
      'function clamp(input) {',
      '  return Math.min(input, INTERNAL_LIMIT)',
      '}',
      '',
      'export { clamp }',
    ].join('\n'),
    output: [
      'function clamp(input) {',
      '  return Math.min(input, INTERNAL_LIMIT)',
      '}',
      '',
      'const INTERNAL_LIMIT = 3',
      '',
      'export { clamp }',
    ].join('\n'),
    errors: [{ messageId: 'moveConstantBelow' }],
  },
  {
    code: [
      'function helper() {',
      '  return 1',
      '}',
      '',
      '// keep this note with the reader entrypoint',
      'export function read() {',
      '  return helper()',
      '}',
    ].join('\n'),
    output: null,
    errors: [{ messageId: 'moveHelperBelow' }],
  },
]

const TYPE_VALID_CASES = [
  {
    code: [
      'export type PublicUser = Build<User>',
      '',
      'type Build<T> = { value: T }',
      '',
      'interface User {',
      '  id: string',
      '}',
    ].join('\n'),
  },
  {
    code: [
      'export function accept(input: Build<User>): string {',
      '  return input.value.id',
      '}',
      '',
      'type Build<T> = { value: T }',
      '',
      'interface User {',
      '  id: string',
      '}',
    ].join('\n'),
  },
  {
    code: [
      'export function accept(input: Build<User>): string {',
      '  return input.value.id',
      '}',
      '',
      'interface User {',
      '  id: string',
      '}',
      '',
      'type Build<T> = { value: T }',
    ].join('\n'),
  },
]

const TYPE_INVALID_CASES = [
  {
    code: [
      'type Build<T> = { value: T }',
      '',
      'interface User {',
      '  id: string',
      '}',
      '',
      'export type PublicUser = Build<User>',
    ].join('\n'),
    output: [
      'export type PublicUser = Build<User>',
      '',
      'type Build<T> = { value: T }',
      '',
      'interface User {',
      '  id: string',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }, { messageId: 'moveHelperBelow' }],
  },
  {
    code: [
      'type Build<T> = { value: T }',
      '',
      'interface User {',
      '  id: string',
      '}',
      '',
      'export function accept(input: Build<User>): string {',
      '  return input.value.id',
      '}',
    ].join('\n'),
    output: [
      'export function accept(input: Build<User>): string {',
      '  return input.value.id',
      '}',
      '',
      'type Build<T> = { value: T }',
      '',
      'interface User {',
      '  id: string',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }, { messageId: 'moveHelperBelow' }],
  },
]

const CYCLIC_VALID_CASES = [
  {
    code: [
      'function parseExpression() {',
      '  return parseAtom()',
      '}',
      '',
      'function parseAtom() {',
      '  return parseExpression()',
      '}',
      '',
      'export function parse() {',
      '  return parseExpression()',
      '}',
    ].join('\n'),
  },
  {
    code: [
      'function a() { return b() }',
      'function b() { return c() }',
      'function c() { return a() }',
      '',
      'export function main() { return a() }',
    ].join('\n'),
  },
]

function makeTsRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  })
}
