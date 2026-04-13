import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: read-friendly-order/spec.md
// Class member ordering, test phase ordering, and autofix idempotency.
// Top-level and TypeScript ordering scenarios are in index.test.ts.

// ─── Class member ordering ────────────────────────────────────────────────────

scenario('constructor before public field before methods is allowed', rule, {
  typescript: true,
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
})

scenario('public field before constructor is flagged and constructor is moved first', rule, {
  typescript: true,
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
})

scenario('public field after method that uses it is flagged and field is moved up', rule, {
  typescript: true,
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
})

scenario('method defined before the method it depends on is flagged and reordered', rule, {
  typescript: true,
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
})

scenario('computed method name suppresses class member autofix', rule, {
  typescript: true,
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
  errors: [{ messageId: 'moveMemberBelow' }],
  output: null,
})

scenario('mutually recursive class methods are allowed in any order', rule, {
  typescript: true,
  code: [
    'class Queue {',
    '  constructor() {}',
    '',
    '  submit() {',
    '    this.startTask()',
    '  }',
    '',
    '  private processNext() {',
    '    this.startTask()',
    '  }',
    '',
    '  private startTask() {',
    '    this.processNext()',
    '  }',
    '}',
  ].join('\n'),
})

// ─── Test phase ordering ──────────────────────────────────────────────────────

scenario('beforeEach before afterEach before test calls is allowed', rule, {
  typescript: true,
  code: [
    "import { beforeEach, afterEach, test } from 'vitest'",
    '',
    'beforeEach(() => {})',
    '',
    'afterEach(() => {})',
    '',
    "test('runs', () => {})",
  ].join('\n'),
})

scenario('afterEach before beforeEach is flagged and reordered by autofix', rule, {
  typescript: true,
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
  output: [
    "import { beforeEach, afterEach, test } from 'vitest'",
    '',
    'beforeEach(() => {})',
    '',
    'afterEach(() => {})',
    '',
    "test('runs', () => {})",
  ].join('\n'),
})

scenario('test call before beforeEach is flagged and setup is moved first', rule, {
  typescript: true,
  code: [
    "import { beforeEach, test } from 'vitest'",
    '',
    "test('runs', () => {})",
    '',
    'beforeEach(() => {})',
  ].join('\n'),
  errors: [{ messageId: 'setupBeforeTests' }],
  output: [
    "import { beforeEach, test } from 'vitest'",
    '',
    'beforeEach(() => {})',
    '',
    "test('runs', () => {})",
  ].join('\n'),
})

// ─── Autofix idempotency ──────────────────────────────────────────────────────

scenario('already-canonical top-level order produces no further edits', rule, {
  code: [
    'export function main() {',
    '  return helper()',
    '}',
    '',
    'function helper() {',
    '  return 1',
    '}',
  ].join('\n'),
})

scenario('already-canonical class member order produces no further edits', rule, {
  typescript: true,
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
})

scenario('already-canonical test phase order produces no further edits', rule, {
  typescript: true,
  code: [
    "import { beforeEach, afterEach, test } from 'vitest'",
    '',
    'beforeEach(() => {})',
    '',
    'afterEach(() => {})',
    '',
    "test('runs', () => {})",
  ].join('\n'),
})
