import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: read-friendly-order-autofix/spec.md

// ─── Top-level ordering ───────────────────────────────────────────────────────

scenario('top-level consumer before its helper is allowed', rule, {
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
})

scenario('exported value assigned from helper is allowed when helper is defined below', rule, {
  code: [
    "import value from './value.js'",
    '',
    'const exportedValue = buildValue() + value',
    '',
    'export { exportedValue }',
    '',
    'const buildValue = () => 1',
  ].join('\n'),
})

scenario('exported functions that call each other are allowed in top-down call order', rule, {
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
})

scenario('exported constant defined before unexported helper is allowed', rule, {
  code: [
    'const MAX_COUNT = 3',
    '',
    'function read() {',
    '  return 1',
    '}',
    '',
    'export { MAX_COUNT }',
  ].join('\n'),
})

scenario('helper declared above its consumer is flagged and moved below by autofix', rule, {
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
  errors: [{ messageId: 'moveHelperBelow' }],
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
})

scenario(
  'helper B declared above exported A (which calls B) is flagged and reordered by autofix',
  rule,
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
  },
)

scenario(
  'internal constant above exported function that uses it is flagged and moved below by autofix',
  rule,
  {
    code: [
      'const LIMIT = 10',
      '',
      'export function clamp(n) {',
      '  return Math.min(n, LIMIT)',
      '}',
    ].join('\n'),
    errors: [{ messageId: 'moveConstantBelow' }],
    output: [
      'export function clamp(n) {',
      '  return Math.min(n, LIMIT)',
      '}',
      '',
      'const LIMIT = 10',
    ].join('\n'),
  },
)

scenario('exported constant above function that uses it is flagged and moved below', rule, {
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
  output: [
    'export function limit() {',
    '  return Math.min(MAX_COUNT, 10)',
    '}',
    '',
    'export { MAX_COUNT }',
    '',
    'const MAX_COUNT = 3',
  ].join('\n'),
})

scenario('export const stays in public API band above private class', rule, {
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
  // With banding, export const is in band 3 (public API) and class is in band 4 (private)
  // No violation since the order is correct
})

scenario('internal constant above exported function is flagged and moved below', rule, {
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
  output: [
    'export { clamp }',
    '',
    'function clamp(input) {',
    '  return Math.min(input, INTERNAL_LIMIT)',
    '}',
    '',
    'const INTERNAL_LIMIT = 3',
  ].join('\n'),
})

scenario('ambiguous comment between helper and consumer suppresses autofix', rule, {
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
  errors: [{ messageId: 'moveHelperBelow' }],
  output: null,
})

// ─── Eager evaluation exemptions ─────────────────────────────────────────────

scenario('helper defined before an eagerly-evaluated constant is allowed', rule, {
  code: [
    "import value from './value.js'",
    '',
    'const helper = () => 1',
    '',
    'const total = helper() + value',
    '',
    'export { total }',
  ].join('\n'),
})

scenario('arrow function defined before the constant that calls it is allowed', rule, {
  code: [
    'const buildValue = () => 1',
    '',
    'const cached = buildValue()',
    '',
    'export { cached }',
  ].join('\n'),
})

scenario('constant used in subsequent constant initializer is allowed', rule, {
  code: [
    'const MAX = 3',
    '',
    'const total = MAX + 1',
    '',
    'function useMax() {',
    '  return MAX',
    '}',
  ].join('\n'),
})

scenario('constant used in two subsequent constant initializers is allowed', rule, {
  code: ['const MAX = 3', '', 'const doubled = MAX * 2', '', 'const tripled = MAX * 3'].join('\n'),
})

scenario('eager entrypoint call before helpers is allowed', rule, {
  code: [
    "if (import.meta.url === 'file:///tmp/run.js') main()",
    '',
    "const BUMP_ARGS = ['dev', 'patch']",
    '',
    'function main() {',
    '  return BUMP_ARGS.length',
    '}',
  ].join('\n'),
})

scenario('eager entrypoint with constant and helpers defined below is allowed', rule, {
  code: [
    'const LIMIT = 3',
    '',
    "if (import.meta.url === 'file:///tmp/run.js') main()",
    '',
    'function main() {',
    '  return run()',
    '}',
    '',
    'function run() {',
    '  return LIMIT',
    '}',
  ].join('\n'),
})

// ─── Cyclic dependencies ──────────────────────────────────────────────────────

scenario('mutually recursive helpers are allowed in any order', rule, {
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
})

scenario('three-way cyclic helper group is allowed and does not trigger autofix', rule, {
  code: [
    'function a() { return b() }',
    'function b() { return c() }',
    'function c() { return a() }',
    '',
    'export function main() { return a() }',
  ].join('\n'),
})

// ─── TypeScript type declarations ─────────────────────────────────────────────

scenario('exported type alias using helper types defined below is allowed', rule, {
  typescript: true,
  code: [
    'export type PublicUser = Build<User>',
    '',
    'type Build<T> = { value: T }',
    '',
    'interface User {',
    '  id: string',
    '}',
  ].join('\n'),
})

scenario('exported function using TS types defined below is allowed', rule, {
  typescript: true,
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
})

scenario('exported function using TS types in either order below is allowed', rule, {
  typescript: true,
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
})

scenario('type alias above exported type alias that uses it is flagged and reordered', rule, {
  typescript: true,
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
  output: [
    'export type PublicUser = Build<User>',
    '',
    'type Build<T> = { value: T }',
    '',
    'interface User {',
    '  id: string',
    '}',
  ].join('\n'),
})

scenario(
  'type alias above exported function that uses it in signature is flagged and reordered',
  rule,
  {
    typescript: true,
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
  },
)

// Class member ordering, test phase ordering, and idempotency scenarios
// are in class-and-phases.test.ts (split to stay within file line limits).
