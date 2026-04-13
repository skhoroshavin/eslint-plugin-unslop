import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: export-control/spec.md

const TSCONFIG = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"rootDir":"./src"}}',
}

scenario('module with no exports policy allows any export', rule, {
  files: [TSCONFIG, { path: 'src/models/user/index.ts' }],
  settings: {
    unslop: {
      architecture: {
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: 'src/models/user/index.ts',
  code: 'export const anything = 1',
})

scenario('shared entrypoint uses export-all', rule, {
  files: [TSCONFIG, { path: 'src/shared/ui/index.ts' }, { path: 'src/shared/ui/internal.ts' }],
  settings: {
    unslop: {
      architecture: {
        'shared/ui': { shared: true },
      },
    },
  },
  filename: 'src/shared/ui/index.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('shared types entrypoint uses export-all', rule, {
  files: [TSCONFIG, { path: 'src/shared/ui/types.ts' }, { path: 'src/shared/ui/internal.ts' }],
  settings: {
    unslop: {
      architecture: {
        'shared/ui': { shared: true },
      },
    },
  },
  filename: 'src/shared/ui/types.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('non-shared entrypoint uses export-all', rule, {
  files: [TSCONFIG, { path: 'src/models/user/index.ts' }, { path: 'src/models/user/internal.ts' }],
  settings: {
    unslop: {
      architecture: {
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: 'src/models/user/index.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('exported symbol matching the regex contract is allowed', rule, {
  files: [TSCONFIG, { path: 'src/repository/user/index.ts' }],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: 'src/repository/user/index.ts',
  code: 'export function createUserRepo() {}',
})

scenario('exported symbol violating the regex contract is reported', rule, {
  files: [TSCONFIG, { path: 'src/repository/user/index.ts' }],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: 'src/repository/user/index.ts',
  code: 'export const helper = 1',
  errors: [{ messageId: 'symbolDenied' }],
})

scenario(
  'default export in constrained entrypoint is reported when contract has no default pattern',
  rule,
  {
    files: [TSCONFIG, { path: 'src/repository/user/types.ts' }],
    settings: {
      unslop: {
        architecture: {
          'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
          'models/*': { imports: ['utils'] },
        },
      },
    },
    filename: 'src/repository/user/types.ts',
    code: 'export default function create() {}',
    errors: [{ messageId: 'symbolDenied' }],
  },
)

scenario('export-all in constrained entrypoint is reported', rule, {
  files: [
    TSCONFIG,
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/internal.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
        'models/*': { imports: ['utils'] },
      },
    },
  },
  filename: 'src/repository/user/index.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  files: [TSCONFIG, { path: 'src/repository/user/index.ts' }],
  settings: {
    unslop: {},
  },
  filename: 'src/repository/user/index.ts',
  code: 'export const helper = 1',
})

scenario('non-entrypoint file with export-all is rejected', rule, {
  files: [TSCONFIG, { path: 'src/utils/helpers.ts' }, { path: 'src/utils/internal.ts' }],
  settings: {
    unslop: {
      architecture: {
        'utils/*': { imports: ['shared/*'] },
      },
    },
  },
  filename: 'src/utils/helpers.ts',
  code: "export * from './internal.ts'",
  errors: [{ messageId: 'exportAllForbidden' }],
})
