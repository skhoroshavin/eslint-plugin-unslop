import node_path from 'node:path'

import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: import-control/spec.md

const TSCONFIG_WITH_ROOT_DIR = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"rootDir":"./src"}}',
}

const TSCONFIG_WITH_ALIAS = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"rootDir":"./src","baseUrl":".","paths":{"@/*":["src/*"]}}}',
}

const VIRTUAL_IMPORT_CONTROL_FILE = '/virtual/unslop/src/repository/user/index.ts'

function missingTsconfigMessage(filename: string): string {
  return `TypeScript project context unavailable for "${filename}". No tsconfig.json found while searching from "${node_path.dirname(filename)}".`
}

scenario('cross-module import declared in the allowlist is allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { UserModel } from '../../models/user/public.ts'",
    },
    { path: 'src/models/user/public.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [], entrypoints: ['public.ts'] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario(
  'cross-module alias import to configured entrypoint declared in the allowlist is allowed',
  rule,
  {
    files: [
      TSCONFIG_WITH_ALIAS,
      {
        path: 'src/repository/user/service.ts',
        content: "import { UserModel } from '@/models/user/public.ts'",
      },
      { path: 'src/models/user/public.ts' },
    ],
    architecture: {
      'repository/*': { imports: ['models/*'] },
      'models/*': { imports: [], entrypoints: ['public.ts'] },
    },
    filename: 'src/repository/user/service.ts',
  },
)

scenario('cross-module import to configured module defaults to index entrypoint', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { UserModel } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario('type-only cross-module import declared in imports is allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import type { UserModel } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario('type-only cross-module import declared only in typeImports is allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { type UserModel } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: [], typeImports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario('cross-module import not declared in the allowlist is reported', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/index.ts' },
    {
      path: 'src/models/user/index.ts',
      content: "import { createUserRepo } from '../../repository/user/index.ts'",
    },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/models/user/index.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario('configured module that omits typeImports denies type-only imports by default', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import type { UserModel } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: [] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/service.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario('mixed import declaration does not use typeImports', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { type UserModel, createUser } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: [], typeImports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/service.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario('cross-module import targets internal file outside configured entrypoints', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { hidden } from '../../models/user/internal.ts'",
    },
    { path: 'src/models/user/public.ts' },
    { path: 'src/models/user/internal.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [], entrypoints: ['public.ts'] },
  },
  filename: 'src/repository/user/service.ts',
  errors: [
    {
      messageId: 'nonEntrypoint',
      data: { specifier: '../../models/user/internal.ts' },
    },
  ],
})

scenario('type-only cross-module import to internal file outside configured entrypoints', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import type { Hidden } from '../../models/user/internal.ts'",
    },
    { path: 'src/models/user/public.ts' },
    { path: 'src/models/user/internal.ts' },
  ],
  architecture: {
    'repository/*': { imports: [], typeImports: ['models/*'] },
    'models/*': { imports: [], entrypoints: ['public.ts'] },
  },
  filename: 'src/repository/user/service.ts',
  errors: [
    {
      messageId: 'nonEntrypoint',
      data: { specifier: '../../models/user/internal.ts' },
    },
  ],
})

scenario('local cross-module namespace import is rejected', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import * as UserModels from '../../models/user/public.ts'",
    },
    { path: 'src/models/user/public.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [], entrypoints: ['public.ts'] },
  },
  filename: 'src/repository/user/service.ts',
  errors: [{ messageId: 'namespaceLocalForbidden' }],
})

scenario('external dependency namespace import is allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import * as nodePath from 'node:path'\nvoid nodePath.sep",
    },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario(
  'shallow relative import to child module configured entrypoint is implicitly allowed',
  rule,
  {
    files: [
      TSCONFIG_WITH_ROOT_DIR,
      { path: 'src/index.ts', content: "import rules from './rules/public.ts'" },
      { path: 'src/rules/public.ts' },
    ],
    architecture: {
      rules: { entrypoints: ['public.ts'] },
    },
    filename: 'src/index.ts',
  },
)

scenario('shallow relative import to child module default entrypoint is implicitly allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/index.ts', content: "import rules from './rules/index.ts'" },
    { path: 'src/rules/index.ts' },
  ],
  filename: 'src/index.ts',
})

scenario(
  'shallow relative import to child module non-entrypoint applies normal boundary checks',
  rule,
  {
    files: [
      TSCONFIG_WITH_ROOT_DIR,
      { path: 'src/index.ts', content: "import x from './rules/internal.ts'" },
      { path: 'src/rules/internal.ts' },
    ],
    filename: 'src/index.ts',
    errors: [{ messageId: 'notAllowed' }],
  },
)

scenario('cross-module alias import using equivalent index specifier variant is allowed', rule, {
  files: [
    TSCONFIG_WITH_ALIAS,
    {
      path: 'src/repository/user/service.ts',
      content: "import { UserModel } from '@/models/user'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario('cross-module import to anonymous module allows only index entrypoint candidate', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { value } from '../../unknown/public/index.ts'",
    },
    { path: 'src/unknown/public/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['unknown/public'] },
  },
  filename: 'src/repository/user/service.ts',
})

scenario('cross-module import to anonymous module non-index entrypoint is reported', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import { value } from '../../unknown/public/types.ts'",
    },
    { path: 'src/unknown/public/types.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['unknown/public'] },
  },
  filename: 'src/repository/user/service.ts',
  errors: [{ messageId: 'nonEntrypoint' }],
})

scenario('anonymous modules default to denying type-only cross-module imports', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/service.ts',
      content: "import type { UserModel } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  filename: 'src/repository/user/service.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario('same-module relative import one level deep is allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { util } from './helpers/index.ts'",
    },
    { path: 'src/repository/user/helpers/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/index.ts',
})

scenario('same-module relative import two levels deep is reported', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { helper } from './helpers/internal/index.ts'",
    },
    { path: 'src/repository/user/helpers/internal/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
    'models/*': { imports: [] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'tooDeep' }],
})

scenario('same-module alias import two levels deep is reported', rule, {
  files: [
    TSCONFIG_WITH_ALIAS,
    {
      path: 'src/repository/user/index.ts',
      content: "import { helper } from '@/repository/user/helpers/internal/index.ts'",
    },
    { path: 'src/repository/user/helpers/internal/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'tooDeep' }],
})

scenario('semantic project setup failure fails open without reporting', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/outside/tsconfig.json',
      content: '{',
    },
    { path: 'src/outside/repository/user/index.ts' },
    {
      path: 'src/outside/models/user/index.ts',
      content: "import { createUserRepo } from '../../repository/user/index.ts'",
    },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
  },
  filename: 'src/outside/models/user/index.ts',
  errors: [{ messageId: 'configurationError' }],
})

scenario('discovered tsconfig that excludes linted file reports configuration error', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/outside/tsconfig.json',
      content: '{"compilerOptions":{"rootDir":"."},"include":["repository/**/*.ts"]}',
    },
    { path: 'src/outside/repository/user/index.ts' },
    {
      path: 'src/outside/models/user/index.ts',
      content: "import { createUserRepo } from '../../repository/user/index.ts'",
    },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
  },
  filename: 'src/outside/models/user/index.ts',
  errors: [{ messageId: 'configurationError' }],
})

scenario('missing tsconfig reports actionable path context', rule, {
  architecture: {
    'repository/*': { imports: ['models/*'] },
  },
  filename: VIRTUAL_IMPORT_CONTROL_FILE,
  code: "import { createUserRepo } from '../../models/user/index.ts'",
  errors: [
    {
      messageId: 'configurationError',
      data: { details: missingTsconfigMessage(VIRTUAL_IMPORT_CONTROL_FILE) },
    },
  ],
})

scenario('exact module matcher takes precedence over wildcard matcher', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/special/index.ts',
      content: "import { x } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: [] },
    'repository/special': { imports: ['models/*'] },
  },
  filename: 'src/repository/special/index.ts',
})

scenario('parent import allowlist entry does not allow importing a child module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { value } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario('self-or-child import allowlist entry allows importing the parent module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { value } from '../../models/index.ts'",
    },
    { path: 'src/models/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/+'] },
  },
  filename: 'src/repository/user/index.ts',
})

scenario('self-or-child import allowlist entry allows importing a direct child module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { value } from '../../models/user/index.ts'",
    },
    { path: 'src/models/user/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/+'] },
  },
  filename: 'src/repository/user/index.ts',
})

scenario('self-or-child import allowlist entry does not allow importing a deeper module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { value } from '../../models/user/internal/index.ts'",
    },
    { path: 'src/models/user/internal/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/+'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario('models child allowlist does not match the parent entrypoint module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/repository/user/index.ts',
      content: "import { value } from '../../models/index.ts'",
    },
    { path: 'src/models/index.ts' },
  ],
  architecture: {
    'repository/*': { imports: ['models/*'] },
  },
  filename: 'src/repository/user/index.ts',
  errors: [{ messageId: 'notAllowed' }],
})

scenario(
  'unsupported architecture key selector is reported through shared config validation',
  rule,
  {
    files: [
      TSCONFIG_WITH_ROOT_DIR,
      {
        path: 'src/repository/user/index.ts',
        content: "import { value } from '../../models/index.ts'",
      },
      { path: 'src/models/index.ts' },
    ],
    architecture: {
      'repository/*': { imports: ['models/+'] },
      'models/+': { imports: [] },
    },
    filename: 'src/repository/user/index.ts',
    errors: [{ messageId: 'configurationError' }],
  },
)

scenario('wildcard import allowlist pattern allows import from explicitly-named sub-module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/services/api/index.ts',
      content: "import { LLM } from '../../plugins/llm/index.ts'",
    },
    { path: 'src/plugins/llm/index.ts' },
  ],
  architecture: {
    'services/*': { imports: ['plugins/*'] },
  },
  filename: 'src/services/api/index.ts',
})

scenario(
  'wildcard import allowlist pattern does not allow import from deeper explicitly-named sub-module',
  rule,
  {
    files: [
      TSCONFIG_WITH_ROOT_DIR,
      {
        path: 'src/services/api/index.ts',
        content: "import { x } from '../../plugins/llm/internal/index.ts'",
      },
      { path: 'src/plugins/llm/internal/index.ts' },
    ],
    architecture: {
      'services/*': { imports: ['plugins/*'] },
    },
    filename: 'src/services/api/index.ts',
    errors: [{ messageId: 'notAllowed' }],
  },
)

// Windows backslash path normalization is exercised by architecture-policy internals
// but cannot be triggered through context.filename on non-Windows platforms.
// Covered at the unit level by normalizePath() behavior; no e2e scenario possible here.
