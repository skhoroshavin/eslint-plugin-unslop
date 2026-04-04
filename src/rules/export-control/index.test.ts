import { test } from 'vitest'
import rule from './index.js'
import { ruleTester } from '../../utils/test-fixtures.js'

test('does not report when module has no exports policy', () => {
  ruleTester.run('export-control', rule, {
    valid: [
      {
        filename: '/repo/src/models/user/index.ts',
        code: 'export const anything = 1',
        settings: {
          unslop: {
            sourceRoot: 'src',
            architecture: {
              'models/*': {
                imports: ['utils'],
              },
            },
          },
        },
      },
    ],
    invalid: [],
  })
})

test('allows symbols matching regex policy', () => {
  ruleTester.run('export-control', rule, {
    valid: [
      {
        filename: '/repo/src/repository/user/index.ts',
        code: 'export function createUserRepo() {}',
        settings: constrainedSettings,
      },
    ],
    invalid: [],
  })
})

test('reports symbols that violate regex policy', () => {
  ruleTester.run('export-control', rule, {
    valid: [],
    invalid: [
      {
        filename: '/repo/src/repository/user/index.ts',
        code: 'export const helper = 1',
        settings: constrainedSettings,
        errors: [{ messageId: 'symbolDenied' }],
      },
    ],
  })
})

test('reports default export when default is not allowed', () => {
  ruleTester.run('export-control', rule, {
    valid: [],
    invalid: [
      {
        filename: '/repo/src/repository/user/types.ts',
        code: 'export default function create() {}',
        settings: constrainedSettings,
        errors: [{ messageId: 'symbolDenied' }],
      },
    ],
  })
})

test('rejects export-all in constrained entrypoint', () => {
  ruleTester.run('export-control', rule, {
    valid: [],
    invalid: [
      {
        filename: '/repo/src/repository/user/index.ts',
        code: "export * from './internal.ts'",
        settings: constrainedSettings,
        errors: [{ messageId: 'exportAllForbidden' }],
      },
    ],
  })
})

const constrainedSettings = {
  unslop: {
    sourceRoot: 'src',
    architecture: {
      'repository/*': {
        imports: ['models/*'],
        exports: ['^create\\w+Repo$'],
      },
      'models/*': {
        imports: ['utils'],
      },
    },
  },
}
