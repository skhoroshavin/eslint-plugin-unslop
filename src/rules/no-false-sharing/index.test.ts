import { afterAll, beforeEach, describe, test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import rule from './index.js'
import { ProjectFixture } from '../../utils/test-fixtures/index.js'

beforeEach(() => {
  fixture.init()
})

afterAll(() => {
  fixture.cleanup()
})

test('non-shared file not imported by anything has no error', () => {
  fixture.write(FEATURE_A_UTIL, EXPORT_X)
  assertValid(FEATURE_A_UTIL)
})

test('non-shared file imported by only one module has no error', () => {
  fixture.write(FEATURE_A_UTIL, EXPORT_X)
  fixture.write(FEATURE_B_CONSUMER, IMPORT_FROM_FEATURE_A)
  assertValid(FEATURE_A_UTIL)
})

describe('dir-mode', () => {
  beforeEach(() => {
    fixture.write(SHARED_UTIL, EXPORT_X)
  })

  test('shared file imported by files in two different folders has no error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_CONSUMER, IMPORT_FROM_SHARED)
    assertValid(SHARED_UTIL)
  })

  test('shared file imported only by files in the same folder raises not-truly-shared error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_A_CONSUMER_B, IMPORT_FROM_SHARED)
    assertInvalid(SHARED_UTIL, 'only used by: featureA -> Must be used by 2+ entities')
  })

  test('test files do not count as consumers - one non-test dir and test files still raises error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_TEST, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_C_TEST, IMPORT_FROM_SHARED)
    assertInvalid(SHARED_UTIL, 'only used by: featureA -> Must be used by 2+ entities')
  })

  test('test files do not prevent valid cases - two non-test dirs and one test dir has no error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_CONSUMER, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_C_TEST, IMPORT_FROM_SHARED)
    assertValid(SHARED_UTIL)
  })
})

const SHARED_SETTINGS = {
  unslop: {
    sourceRoot: 'src',
    architecture: {
      shared: { shared: true },
    },
  },
}

const EXPORT_X = 'export const x = 1'
const IMPORT_FROM_SHARED = "import { x } from '../shared'"
const IMPORT_FROM_FEATURE_A = "import { x } from '../featureA/util'"

const SHARED_UTIL = 'src/shared/index.ts'
const FEATURE_A_UTIL = 'src/featureA/util.ts'
const FEATURE_A_CONSUMER_A = 'src/featureA/consumerA.ts'
const FEATURE_A_CONSUMER_B = 'src/featureA/consumerB.ts'
const FEATURE_B_CONSUMER = 'src/featureB/consumer.ts'
const FEATURE_B_TEST = 'src/featureB/consumer.test.ts'
const FEATURE_C_TEST = 'src/featureC/consumer.test.ts'

function assertValid(filename: string) {
  makeTsRuleTester().run('no-false-sharing', rule, {
    valid: [{ code: fixture.read(filename), filename: fixture.filePath(filename) }],
    invalid: [],
  })
}

function assertInvalid(filename: string, error: string) {
  makeTsRuleTester().run('no-false-sharing', rule, {
    valid: [],
    invalid: [
      {
        code: fixture.read(filename),
        filename: fixture.filePath(filename),
        errors: [{ message: error }],
      },
    ],
  })
}

function makeTsRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser,
      parserOptions: {
        project: fixture.filePath('tsconfig.json'),
        tsconfigRootDir: fixture.filePath('.'),
      },
    },
    settings: SHARED_SETTINGS,
  })
}

const fixture = new ProjectFixture({
  prefix: 'false-sharing-test-',
  files: [
    { path: 'tsconfig.json', content: '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}' },
  ],
})
