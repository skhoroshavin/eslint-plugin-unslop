import { test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import rule from './index.js'
import { ruleTester } from '../../utils/test-fixtures/index.js'

test('autofixes top-level helper ordering', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: [],
    invalid: TOP_LEVEL_INVALID_CASES,
  })
})

test('autofixes class member ordering', () => {
  runClassOrderingCases()
})

test('autofixes test phase ordering', () => {
  runTestPhaseCases()
})

test('suppresses autofix for ambiguous comment ownership', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: [],
    invalid: AMBIGUOUS_COMMENT_CASES,
  })
})

test('does not report cyclic dependency groups', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: CYCLIC_VALID_CASES,
    invalid: [],
  })
})

test('idempotent: canonical order produces no edits', () => {
  ruleTester.run('read-friendly-order', rule, {
    valid: IDEMPOTENT_VALID_CASES,
    invalid: [],
  })
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: IDEMPOTENT_CLASS_CASES,
    invalid: [],
  })
})

function runClassOrderingCases(): void {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: CLASS_VALID_CASES,
    invalid: CLASS_INVALID_CASES,
  })
}

function runTestPhaseCases(): void {
  makeTsRuleTester().run('read-friendly-order', rule, {
    valid: TEST_PHASE_VALID_CASES,
    invalid: TEST_PHASE_INVALID_CASES,
  })
}

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
    output: [
      'class Service {',
      '  constructor() {',
      '    this.label.length',
      '  }',
      '',
      "public label = 'service'",
      '',
      'run() {',
      '    return this.label.length',
      '  }',
      '',
      'compute() {',
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
    output: [
      'class Service {',
      '  constructor() {}',
      '',
      "public label = 'service'",
      '',
      'run() {',
      '    return this.compute()',
      '  }',
      '',
      'compute() {',
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
    output: [
      'class Service {',
      '  constructor() {}',
      '',
      'public label = this.run()',
      '',
      'run() {',
      '    return this.compute()',
      '  }',
      '',
      'compute() {',
      '    return 1',
      '  }',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveMemberBelow' }],
  },
  {
    code: [
      'class Service {',
      '  compute() {',
      '    return 1',
      '  }',
      '',
      "  ['run']() {",
      '    return this.compute()',
      '  }',
      '}',
    ].join('\n'),
    output: null,
    errors: [{ messageId: 'moveMemberBelow' }],
  },
]

const TEST_PHASE_VALID_CASES = [
  {
    code: [
      "import { beforeEach, afterEach, test } from 'vitest'",
      '',
      'beforeEach(() => {})',
      '',
      'afterEach(() => {})',
      '',
      "test('runs', () => {})",
    ].join('\n'),
  },
]

const TEST_PHASE_INVALID_CASES = [
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
    output: [
      "import { beforeEach, afterEach, test } from 'vitest'",
      '',
      'beforeEach(() => {})',
      '',
      'afterEach(() => {})',
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
    output: [
      "import { beforeEach, test } from 'vitest'",
      '',
      'beforeEach(() => {})',
      '',
      "test('runs', () => {})",
    ].join('\n'),
    errors: [{ messageId: 'setupBeforeTests' }],
  },
]

const TOP_LEVEL_INVALID_CASES = [
  {
    code: [
      "import value from './value.js'",
      '',
      'function helper() { return value }',
      '',
      'export default {',
      '  create() {',
      '    return helper()',
      '  },',
      '}',
    ].join('\n'),
    output: [
      "import value from './value.js'",
      '',
      'export default {',
      '  create() {',
      '    return helper()',
      '  },',
      '}',
      '',
      'function helper() { return value }',
    ].join('\n'),
    errors: [{ messageId: 'moveHelperBelow' }],
  },
  {
    code: [
      'const LIMIT = 10',
      '',
      'export function clamp(n) {',
      '  return Math.min(n, LIMIT)',
      '}',
    ].join('\n'),
    output: [
      'export function clamp(n) {',
      '  return Math.min(n, LIMIT)',
      '}',
      '',
      'const LIMIT = 10',
    ].join('\n'),
    errors: [{ messageId: 'moveConstantBelow' }],
  },
]

const AMBIGUOUS_COMMENT_CASES = [
  {
    code: [
      'function helper() {',
      '  return 1',
      '}',
      '',
      '// this comment sits between helper and consumer',
      'export function read() {',
      '  return helper()',
      '}',
    ].join('\n'),
    output: null,
    errors: [{ messageId: 'moveHelperBelow' }],
  },
]

const CYCLIC_VALID_CASES = [
  {
    code: [
      'function a() { return b() }',
      'function b() { return a() }',
      '',
      'export function main() { return a() }',
    ].join('\n'),
  },
]

const IDEMPOTENT_VALID_CASES = [
  {
    code: [
      'export function main() {',
      '  return helper()',
      '}',
      '',
      'function helper() {',
      '  return 1',
      '}',
    ].join('\n'),
  },
  {
    code: [
      "import { beforeEach, afterEach, test } from 'vitest'",
      '',
      'beforeEach(() => {})',
      '',
      'afterEach(() => {})',
      '',
      "test('runs', () => {})",
    ].join('\n'),
  },
]

const IDEMPOTENT_CLASS_CASES = [
  {
    code: [
      'class Service {',
      '  constructor() {',
      '    this.init()',
      '  }',
      '',
      "  public name = 'svc'",
      '',
      '  init() {',
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

function makeTsRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  })
}
