import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: read-friendly-order/spec.md
// TypeScript property type annotation dependency ordering.

scenario('interface above class with property type annotation is flagged and autofixed', rule, {
  typescript: true,
  code: [
    'export interface ApplicantPersonal {',
    '  name: string',
    '}',
    '',
    'export class Applicant {',
    '  personal: ApplicantPersonal',
    '}',
  ].join('\n'),
  errors: [{ messageId: 'moveHelperBelow' }],
  output: [
    'export class Applicant {',
    '  personal: ApplicantPersonal',
    '}',
    '',
    'export interface ApplicantPersonal {',
    '  name: string',
    '}',
  ].join('\n'),
})

scenario('multiple interfaces above class using them are flagged and reordered', rule, {
  typescript: true,
  code: [
    'export interface A {',
    '  x: number',
    '}',
    '',
    'export interface B {',
    '  y: string',
    '}',
    '',
    'export class C {',
    '  a: A',
    '',
    '  b: B',
    '}',
  ].join('\n'),
  errors: [{ messageId: 'moveHelperBelow' }, { messageId: 'moveHelperBelow' }],
  output: [
    'export class C {',
    '  a: A',
    '',
    '  b: B',
    '}',
    '',
    'export interface A {',
    '  x: number',
    '}',
    '',
    'export interface B {',
    '  y: string',
    '}',
  ].join('\n'),
})

scenario('type above unrelated class is allowed', rule, {
  typescript: true,
  code: [
    'export interface Config {',
    '  enabled: boolean',
    '}',
    '',
    'export class Applicant {',
    '  name: string',
    '}',
  ].join('\n'),
})

scenario('type in constructor parameter above class is flagged and autofixed', rule, {
  typescript: true,
  code: [
    'export interface Config {',
    '  enabled: boolean',
    '}',
    '',
    'export class Applicant {',
    '  constructor(cfg: Config) {}',
    '}',
  ].join('\n'),
  errors: [{ messageId: 'moveHelperBelow' }],
  output: [
    'export class Applicant {',
    '  constructor(cfg: Config) {}',
    '}',
    '',
    'export interface Config {',
    '  enabled: boolean',
    '}',
  ].join('\n'),
})

scenario(
  'already-correct class-first order with property type annotations produces no edits',
  rule,
  {
    typescript: true,
    code: [
      'export class Applicant {',
      '  personal: ApplicantPersonal',
      '}',
      '',
      'export interface ApplicantPersonal {',
      '  name: string',
      '}',
    ].join('\n'),
  },
)
