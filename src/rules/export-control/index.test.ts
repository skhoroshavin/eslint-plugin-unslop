import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: architecture-import-export-control/spec.md

scenario('module with no exports policy allows any export', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: '/repo/src/models/user/index.ts',
  code: 'export const anything = 1',
})

scenario('shared entrypoint uses export-all', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'shared/ui': { shared: true },
      },
    },
  },
  filename: '/repo/src/shared/ui/index.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('exported symbol matching the regex contract is allowed', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: '/repo/src/repository/user/index.ts',
  code: 'export function createUserRepo() {}',
})

scenario('exported symbol violating the regex contract is reported', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: '/repo/src/repository/user/index.ts',
  code: 'export const helper = 1',
  errors: [{ messageId: 'symbolDenied' }],
})

scenario(
  'default export in constrained entrypoint is reported when contract has no default pattern',
  rule,
  {
    settings: {
      unslop: {
        sourceRoot: 'src',
        architecture: {
          'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
          'models/*': { imports: ['utils'] },
        },
      },
    },
    filename: '/repo/src/repository/user/types.ts',
    code: 'export default function create() {}',
    errors: [{ messageId: 'symbolDenied' }],
  },
)

scenario('export-all in constrained entrypoint is reported', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: '/repo/src/repository/user/index.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  settings: {
    unslop: { sourceRoot: 'src' },
  },
  filename: '/repo/src/repository/user/index.ts',
  code: 'export const helper = 1',
})
