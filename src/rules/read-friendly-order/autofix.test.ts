import { test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import rule from './index.js'

test('autofixes class member ordering', () => {
  runClassOrderingCases()
})

test('autofixes test phase ordering', () => {
  runTestPhaseCases()
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

function makeTsRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  })
}
