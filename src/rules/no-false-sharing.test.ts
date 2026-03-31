import { afterAll, beforeEach, describe, test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import rule from './no-false-sharing.js'
import { ProjectFixture } from '../utils/test-fixtures.js'

beforeEach(() => {
  fixture.init()
})

afterAll(() => {
  fixture.cleanup()
})

test('non-shared file not imported by anything has no error', () => {
  fixture.write(FEATURE_A_UTIL, EXPORT_X)
  assertValid(FEATURE_A_UTIL, SHARED_DIR_DEFAULT_MODE)
})

test('non-shared file imported by only one module has no error', () => {
  fixture.write(FEATURE_A_UTIL, EXPORT_X)
  fixture.write(FEATURE_B_CONSUMER, IMPORT_FROM_FEATURE_A)
  assertValid(FEATURE_A_UTIL, SHARED_DIR_DEFAULT_MODE)
})

describe('file-mode', () => {
  beforeEach(() => {
    fixture.write(SHARED_UTIL, EXPORT_X)
  })

  test('shared file imported by two different files has no error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_A_CONSUMER_B, IMPORT_FROM_SHARED)
    assertValid(SHARED_UTIL, SHARED_DIR_FILE_MODE)
  })

  test('shared file imported by only one file raises not-truly-shared error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    assertInvalid(
      SHARED_UTIL,
      SHARED_DIR_FILE_MODE,
      'only used by: featureA/consumerA.ts -> Must be used by 2+ entities',
    )
  })

  test('test files do not count as consumers - one non-test importer and test files still raises error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_A_TEST, IMPORT_FROM_SHARED)
    assertInvalid(
      SHARED_UTIL,
      SHARED_DIR_FILE_MODE,
      'only used by: featureA/consumerA.ts -> Must be used by 2+ entities',
    )
  })

  test('test files do not prevent valid cases - two non-test importers and test importer has no error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_A_CONSUMER_B, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_TEST, IMPORT_FROM_SHARED)
    assertValid(SHARED_UTIL, SHARED_DIR_FILE_MODE)
  })
})

describe('dir-mode', () => {
  beforeEach(() => {
    fixture.write(SHARED_UTIL, EXPORT_X)
  })

  test('shared file imported by files in two different folders has no error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_CONSUMER, IMPORT_FROM_SHARED)
    assertValid(SHARED_UTIL, SHARED_DIR_DIR_MODE)
  })

  test('shared file imported only by files in the same folder raises not-truly-shared error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_A_CONSUMER_B, IMPORT_FROM_SHARED)
    assertInvalid(
      SHARED_UTIL,
      SHARED_DIR_DIR_MODE,
      'only used by: featureA -> Must be used by 2+ entities',
    )
  })

  test('test files do not count as consumers - one non-test dir and test files still raises error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_TEST, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_C_TEST, IMPORT_FROM_SHARED)
    assertInvalid(
      SHARED_UTIL,
      SHARED_DIR_DIR_MODE,
      'only used by: featureA -> Must be used by 2+ entities',
    )
  })

  test('test files do not prevent valid cases - two non-test dirs and one test dir has no error', () => {
    fixture.write(FEATURE_A_CONSUMER_A, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_B_CONSUMER, IMPORT_FROM_SHARED)
    fixture.write(FEATURE_C_TEST, IMPORT_FROM_SHARED)
    assertValid(SHARED_UTIL, SHARED_DIR_DIR_MODE)
  })
})

const SHARED_DIR_DEFAULT_MODE = [{ dirs: [{ path: 'shared' }] }]
const SHARED_DIR_FILE_MODE = [{ dirs: [{ path: 'shared', mode: 'file' }] }]
const SHARED_DIR_DIR_MODE = [{ dirs: [{ path: 'shared', mode: 'dir' }] }]

const EXPORT_X = 'export const x = 1'
const IMPORT_FROM_SHARED = "import { x } from '../shared/util'"
const IMPORT_FROM_FEATURE_A = "import { x } from '../featureA/util'"

const SHARED_UTIL = 'shared/util.ts'
const FEATURE_A_UTIL = 'featureA/util.ts'
const FEATURE_A_CONSUMER_A = 'featureA/consumerA.ts'
const FEATURE_A_CONSUMER_B = 'featureA/consumerB.ts'
const FEATURE_B_CONSUMER = 'featureB/consumer.ts'
const FEATURE_A_TEST = 'featureA/consumerA.test.ts'
const FEATURE_B_TEST = 'featureB/consumer.test.ts'
const FEATURE_C_TEST = 'featureC/consumer.test.ts'

function assertValid(filename: string, options: unknown) {
  makeTsRuleTester().run('no-false-sharing', rule, {
    valid: [{ code: fixture.read(filename), filename: fixture.filePath(filename), options }],
    invalid: [],
  })
}

function assertInvalid(filename: string, options: unknown, error: string) {
  makeTsRuleTester().run('no-false-sharing', rule, {
    valid: [],
    invalid: [
      {
        code: fixture.read(filename),
        filename: fixture.filePath(filename),
        options,
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
  })
}

const fixture = new ProjectFixture({
  prefix: 'false-sharing-test-',
  files: [
    { path: 'tsconfig.json', content: '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}' },
  ],
})
