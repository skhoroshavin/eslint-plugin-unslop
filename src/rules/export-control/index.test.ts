import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: export-control/spec.md

const TSCONFIG = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"rootDir":"./src"}}',
}

scenario('module with no exports policy allows any export', rule, {
  files: [TSCONFIG, { path: 'src/models/user/index.ts', content: 'export const anything = 1' }],
  architecture: {
    'models/*': { imports: ['utils'] },
  },
  filename: 'src/models/user/index.ts',
})

scenario('shared entrypoint uses export-all', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/ui/index.ts', content: "export * from './internal.ts'" },
    { path: 'src/shared/ui/internal.ts' },
  ],
  architecture: {
    'shared/ui': { shared: true },
  },
  filename: 'src/shared/ui/index.ts',
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('shared types entrypoint uses export-all', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/ui/types.ts', content: "export * from './internal.ts'" },
    { path: 'src/shared/ui/internal.ts' },
  ],
  architecture: {
    'shared/ui': { shared: true, entrypoints: ['types.ts'] },
  },
  filename: 'src/shared/ui/types.ts',
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('non-shared entrypoint uses export-all', rule, {
  files: [
    TSCONFIG,
    { path: 'src/models/user/index.ts', content: "export * from './internal.ts'" },
    { path: 'src/models/user/internal.ts' },
  ],
  architecture: {
    'models/*': { imports: ['utils'] },
  },
  filename: 'src/models/user/index.ts',
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('exported symbol matching the regex contract is allowed', rule, {
  files: [
    TSCONFIG,
    { path: 'src/repository/user/index.ts', content: 'export function createUserRepo() {}' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
    'models/*': { imports: ['utils'] },
  },
  filename: 'src/repository/user/index.ts',
})

scenario('exported symbol violating the regex contract is reported', rule, {
  files: [TSCONFIG, { path: 'src/repository/user/index.ts', content: 'export const helper = 1' }],
  architecture: {
    'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
    'models/*': { imports: ['utils'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'symbolDenied' }],
})

scenario(
  'default export in constrained entrypoint is reported when contract has no default pattern',
  rule,
  {
    files: [
      TSCONFIG,
      { path: 'src/repository/user/types.ts', content: 'export default function create() {}' },
    ],
    architecture: {
      'repository/*': {
        imports: ['models/*'],
        exports: ['^create\\w+Repo$'],
        entrypoints: ['types.ts'],
      },
      'models/*': { imports: ['utils'] },
    },
    filename: 'src/repository/user/types.ts',
    errors: [{ messageId: 'symbolDenied' }],
  },
)

scenario('export-all in constrained entrypoint is reported', rule, {
  files: [
    TSCONFIG,
    { path: 'src/repository/user/index.ts', content: "export * from './internal.ts'" },
    { path: 'src/repository/user/internal.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'], exports: ['^create\\w+Repo$'] },
    'models/*': { imports: ['utils'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'exportAllForbidden' }],
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  files: [TSCONFIG, { path: 'src/repository/user/index.ts', content: 'export const helper = 1' }],
  filename: 'src/repository/user/index.ts',
})

scenario('unsupported architecture key selector reports a configuration error', rule, {
  files: [TSCONFIG, { path: 'src/repository/user/index.ts', content: 'export const helper = 1' }],
  architecture: {
    'repository/+': { imports: [], exports: ['^create\\w+Repo$'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'configurationError' }],
})

scenario('invalid tsconfig reports a configuration error when architecture is configured', rule, {
  files: [
    TSCONFIG,
    { path: 'src/repository/tsconfig.json', content: '{' },
    { path: 'src/repository/user/index.ts', content: 'export const helper = 1' },
  ],
  architecture: {
    'repository/*': { imports: [], exports: ['^create\\w+Repo$'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'configurationError' }],
})

scenario('non-entrypoint file with export-all is rejected', rule, {
  files: [
    TSCONFIG,
    { path: 'src/utils/helpers.ts', content: "export * from './internal.ts'" },
    { path: 'src/utils/internal.ts' },
  ],
  architecture: {
    'utils/*': { imports: ['shared/*'] },
  },
  filename: 'src/utils/helpers.ts',
  errors: [{ messageId: 'exportAllForbidden' }],
})
