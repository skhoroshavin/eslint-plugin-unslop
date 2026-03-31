import { test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import rule from './read-friendly-order.js'
import { ruleTester } from '../utils/test-fixtures.js'

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

test('allows classes with constructor first and ordered members', () => {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: CLASS_VALID_CASES,
    invalid: [],
  })
})

test('flags class member ordering violations', () => {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: [],
    invalid: CLASS_INVALID_CASES,
  })
})

test('allows test file setup, teardown, and tests in read-friendly order', () => {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: TEST_FILE_VALID_CASES,
    invalid: [],
  })
})

test('flags test file setup and teardown order violations', () => {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: [],
    invalid: TEST_FILE_INVALID_CASES,
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
    errors: [{ messageId: 'moveConstantBelow' }],
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
    errors: [{ messageId: 'moveHelperBelow' }, { messageId: 'moveHelperBelow' }],
  },
]

const CLASS_VALID_CASES = [
  {
    code: [
      'class Service {',
      '  constructor() {',
      '    this.bootstrap()',
      '  }',
      '',
      "  public label = 'service'",
      '',
      '  bootstrap() {',
      '    return this.compute()',
      '  }',
      '',
      '  run() {',
      '    return this.compute()',
      '  }',
      '',
      '  compute() {',
      '    return 1',
      '  }',
      '}',
    ].join('\n'),
  },
]

const CLASS_INVALID_CASES = [
  {
    code: [
      'class Service {',
      "  public label = 'service'",
      '',
      '  constructor() {',
      '    this.label.length',
      '  }',
      '',
      '  run() {',
      '    return this.label.length',
      '  }',
      '',
      '  compute() {',
      '    return 1',
      '  }',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'constructorFirst' }],
  },
  {
    code: [
      'class Service {',
      '  constructor() {}',
      '',
      '  run() {',
      '    return this.compute()',
      '  }',
      '',
      "  public label = 'service'",
      '',
      '  compute() {',
      '    return 1',
      '  }',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'publicFieldOrder' }],
  },
  {
    code: [
      'class Service {',
      '  constructor() {}',
      '',
      '  public label = this.run()',
      '',
      '  compute() {',
      '    return 1',
      '  }',
      '',
      '  run() {',
      '    return this.compute()',
      '  }',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveMemberBelow' }],
  },
]

const TEST_FILE_VALID_CASES = [
  {
    code: [
      "import { beforeAll, beforeEach, afterEach, afterAll, test } from 'vitest'",
      '',
      'beforeAll(() => {',
      '  bootstrap()',
      '})',
      '',
      'beforeEach(() => {',
      '  resetState()',
      '})',
      '',
      'afterEach(() => {',
      '  cleanup()',
      '})',
      '',
      'afterAll(() => {',
      '  release()',
      '})',
      '',
      "test('reads shared value', () => {",
      '  expect(readValue()).toBe(MAX_VALUE)',
      '})',
      '',
      'const readValue = () => formatValue()',
      '',
      "const formatValue = () => 'ok'",
      '',
      'const MAX_VALUE = 1',
      '',
      'const bootstrap = () => undefined',
      '',
      'const resetState = () => undefined',
      '',
      'const cleanup = () => undefined',
      '',
      'const release = () => undefined',
    ].join('\n'),
  },
]

const TEST_FILE_INVALID_CASES = [
  {
    code: [
      "import { beforeEach, afterEach, test } from 'vitest'",
      '',
      'afterEach(() => {})',
      '',
      'beforeEach(() => {})',
      '',
      "test('runs', () => {})",
    ].join('\n'),
    errors: [{ messageId: 'setupBeforeTeardown' }],
  },
  {
    code: [
      "import { beforeEach, test } from 'vitest'",
      '',
      "test('runs', () => {})",
      '',
      'beforeEach(() => {})',
    ].join('\n'),
    errors: [{ messageId: 'setupBeforeTests' }],
  },
  {
    code: [
      "import { afterEach, test } from 'vitest'",
      '',
      "test('runs', () => {})",
      '',
      'afterEach(() => {})',
    ].join('\n'),
    errors: [{ messageId: 'teardownBeforeTests' }],
  },
  {
    code: [
      "import { test } from 'vitest'",
      '',
      'const readValue = () => 1',
      '',
      "test('runs', () => {",
      '  expect(readValue()).toBe(1)',
      '})',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }],
  },
  {
    code: [
      "import { beforeEach, test } from 'vitest'",
      '',
      'const resetState = () => undefined',
      '',
      'beforeEach(() => {',
      '  resetState()',
      '})',
      '',
      "test('runs', () => {})",
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }],
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
