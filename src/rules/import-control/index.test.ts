import { afterAll, beforeEach, test } from 'vitest'
import rule from './index.js'
import { ProjectFixture, ruleTester } from '../../utils/test-fixtures.js'

beforeEach(() => {
  fixture.init()
})

afterAll(() => {
  fixture.cleanup()
})

test('allows declared cross-module import through index entrypoint', () => {
  ruleTester.run('import-control', rule, {
    valid: [
      {
        filename: fixture.filePath('src/repository/user/service.ts'),
        code: "import { UserModel } from '../../models/user/index.ts'",
        settings: baseSettings,
      },
    ],
    invalid: [],
  })
})

test('rejects undeclared cross-module imports', () => {
  ruleTester.run('import-control', rule, {
    valid: [],
    invalid: [
      {
        filename: fixture.filePath('src/models/user/index.ts'),
        code: "import { createUserRepo } from '../../repository/user/index.ts'",
        settings: baseSettings,
        errors: [{ messageId: 'notAllowed' }],
      },
    ],
  })
})

test('rejects imports to non-entrypoint files across modules', () => {
  ruleTester.run('import-control', rule, {
    valid: [],
    invalid: [
      {
        filename: fixture.filePath('src/repository/user/service.ts'),
        code: "import { hidden } from '../../models/user/internal.ts'",
        settings: baseSettings,
        errors: [{ messageId: 'nonEntrypoint' }],
      },
    ],
  })
})

test('rejects missing architecture mapping for importer', () => {
  ruleTester.run('import-control', rule, {
    valid: [],
    invalid: [
      {
        filename: fixture.filePath('src/other/stray.ts'),
        code: "import { UserModel } from '../models/user/index.ts'",
        settings: baseSettings,
        errors: [{ messageId: 'missingArchitecture' }],
      },
    ],
  })
})

test('rejects missing architecture mapping for importee', () => {
  ruleTester.run('import-control', rule, {
    valid: [],
    invalid: [
      {
        filename: fixture.filePath('src/repository/user/service.ts'),
        code: "import { anything } from '../../other/stray.ts'",
        settings: baseSettings,
        errors: [{ messageId: 'missingArchitecture' }],
      },
    ],
  })
})

test('enforces shallow same-module relative depth', () => {
  ruleTester.run('import-control', rule, {
    valid: [
      {
        filename: fixture.filePath('src/repository/user/index.ts'),
        code: "import { util } from './helpers/index.ts'",
        settings: baseSettings,
      },
    ],
    invalid: [
      {
        filename: fixture.filePath('src/repository/user/index.ts'),
        code: "import { helper } from './helpers/internal/index.ts'",
        settings: baseSettings,
        errors: [{ messageId: 'tooDeep' }],
      },
    ],
  })
})

const baseSettings = {
  unslop: {
    sourceRoot: 'src',
    architecture: {
      'repository/*': {
        imports: ['models/*'],
      },
      'models/*': {
        imports: [],
      },
    },
  },
}

const fixture = new ProjectFixture({
  prefix: 'import-control-test-',
  files: [
    { path: 'src/repository/user/service.ts' },
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/index.ts' },
    { path: 'src/repository/user/helpers/internal/index.ts' },
    { path: 'src/models/user/index.ts' },
    { path: 'src/models/user/internal.ts' },
    { path: 'src/other/stray.ts' },
  ],
})
