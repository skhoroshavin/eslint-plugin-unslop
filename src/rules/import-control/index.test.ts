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
    { path: 'src/repository/user/service.ts' },
    { path: 'src/models/user/public.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [], entrypoints: ['public.ts'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { UserModel } from '../../models/user/public.ts'",
})

scenario(
  'cross-module alias import to configured entrypoint declared in the allowlist is allowed',
  rule,
  {
    files: [
      TSCONFIG_WITH_ALIAS,
      { path: 'src/repository/user/service.ts' },
      { path: 'src/models/user/public.ts' },
    ],
    settings: {
      unslop: {
        architecture: {
          'repository/*': { imports: ['models/*'] },
          'models/*': { imports: [], entrypoints: ['public.ts'] },
        },
      },
    },
    filename: 'src/repository/user/service.ts',
    code: "import { UserModel } from '@/models/user/public.ts'",
  },
)

scenario('cross-module import to configured module defaults to index entrypoint', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/service.ts' },
    { path: 'src/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { UserModel } from '../../models/user/index.ts'",
})

scenario('cross-module import not declared in the allowlist is reported', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/index.ts' },
    { path: 'src/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/models/user/index.ts',
  code: "import { createUserRepo } from '../../repository/user/index.ts'",
  errors: [{ messageId: 'notAllowed' }],
})

scenario('cross-module import targets internal file outside configured entrypoints', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/service.ts' },
    { path: 'src/models/user/public.ts' },
    { path: 'src/models/user/internal.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [], entrypoints: ['public.ts'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { hidden } from '../../models/user/internal.ts'",
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
    { path: 'src/repository/user/service.ts' },
    { path: 'src/models/user/public.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [], entrypoints: ['public.ts'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import * as UserModels from '../../models/user/public.ts'",
  errors: [{ messageId: 'namespaceLocalForbidden' }],
})

scenario('external dependency namespace import is allowed', rule, {
  files: [TSCONFIG_WITH_ROOT_DIR, { path: 'src/repository/user/service.ts' }],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import * as nodePath from 'node:path'\nvoid nodePath.sep",
})

scenario(
  'shallow relative import to child module configured entrypoint is implicitly allowed',
  rule,
  {
    files: [TSCONFIG_WITH_ROOT_DIR, { path: 'src/index.ts' }, { path: 'src/rules/public.ts' }],
    settings: {
      unslop: {
        architecture: {
          'index.ts': { imports: [] },
          'rules/public.ts': { imports: [], entrypoints: ['public.ts'] },
        },
      },
    },
    filename: 'src/index.ts',
    code: "import rules from './rules/public.ts'",
  },
)

scenario('shallow relative import to child module default entrypoint is implicitly allowed', rule, {
  files: [TSCONFIG_WITH_ROOT_DIR, { path: 'src/index.ts' }, { path: 'src/rules/index.ts' }],
  settings: {
    unslop: {
      architecture: {
        'index.ts': { imports: [] },
        'rules/index.ts': { imports: [] },
      },
    },
  },
  filename: 'src/index.ts',
  code: "import rules from './rules/index.ts'",
})

scenario(
  'shallow relative import to child module non-entrypoint applies normal boundary checks',
  rule,
  {
    files: [TSCONFIG_WITH_ROOT_DIR, { path: 'src/index.ts' }, { path: 'src/rules/internal.ts' }],
    settings: {
      unslop: {
        architecture: {
          'index.ts': { imports: [] },
          rules: { imports: [] },
        },
      },
    },
    filename: 'src/index.ts',
    code: "import x from './rules/internal.ts'",
    errors: [{ messageId: 'notAllowed' }],
  },
)

scenario('cross-module alias import using equivalent index specifier variant is allowed', rule, {
  files: [
    TSCONFIG_WITH_ALIAS,
    { path: 'src/repository/user/service.ts' },
    { path: 'src/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { UserModel } from '@/models/user'",
})

scenario('cross-module import to anonymous module allows only index entrypoint candidate', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/service.ts' },
    { path: 'src/unknown/public/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['unknown/public'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { value } from '../../unknown/public/index.ts'",
})

scenario('cross-module import to anonymous module non-index entrypoint is reported', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/service.ts' },
    { path: 'src/unknown/public/types.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['unknown/public'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { value } from '../../unknown/public/types.ts'",
  errors: [{ messageId: 'nonEntrypoint' }],
})

scenario('same-module relative import one level deep is allowed', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/index.ts',
  code: "import { util } from './helpers/index.ts'",
})

scenario('same-module relative import two levels deep is reported', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/internal/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/index.ts',
  code: "import { helper } from './helpers/internal/index.ts'",
  errors: [{ messageId: 'tooDeep' }],
})

scenario('same-module alias import two levels deep is reported', rule, {
  files: [
    TSCONFIG_WITH_ALIAS,
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/internal/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/index.ts',
  code: "import { helper } from '@/repository/user/helpers/internal/index.ts'",
  errors: [{ messageId: 'tooDeep' }],
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/models/user/index.ts' },
    { path: 'src/repository/user/index.ts' },
  ],
  settings: {
    unslop: {},
  },
  filename: 'src/models/user/index.ts',
  code: "import { createUserRepo } from '../../repository/user/index.ts'",
})

scenario('semantic project setup failure fails open without reporting', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/outside/tsconfig.json',
      content: '{',
    },
    { path: 'src/outside/repository/user/index.ts' },
    { path: 'src/outside/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/outside/models/user/index.ts',
  code: "import { createUserRepo } from '../../repository/user/index.ts'",
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
    { path: 'src/outside/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/outside/models/user/index.ts',
  code: "import { createUserRepo } from '../../repository/user/index.ts'",
  errors: [{ messageId: 'configurationError' }],
})

scenario('missing tsconfig reports actionable path context', rule, {
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
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
    { path: 'src/repository/special/index.ts' },
    { path: 'src/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'repository/*': { imports: [] },
        'repository/special': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/special/index.ts',
  code: "import { x } from '../../models/user/index.ts'",
})

scenario('wildcard import allowlist pattern allows import from explicitly-named sub-module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/services/api/index.ts' },
    { path: 'src/plugins/llm/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        'services/*': { imports: ['plugins/*'] },
        'plugins/llm': { imports: [] },
      },
    },
  },
  filename: 'src/services/api/index.ts',
  code: "import { LLM } from '../../plugins/llm/index.ts'",
})

scenario(
  'wildcard import allowlist pattern does not allow import from deeper explicitly-named sub-module',
  rule,
  {
    files: [
      TSCONFIG_WITH_ROOT_DIR,
      { path: 'src/services/api/index.ts' },
      { path: 'src/plugins/llm/internal/index.ts' },
    ],
    settings: {
      unslop: {
        architecture: {
          'services/*': { imports: ['plugins/*'] },
          'plugins/llm/internal': { imports: [] },
        },
      },
    },
    filename: 'src/services/api/index.ts',
    code: "import { x } from '../../plugins/llm/internal/index.ts'",
    errors: [{ messageId: 'notAllowed' }],
  },
)

// Windows backslash path normalization is exercised by architecture-policy internals
// but cannot be triggered through context.filename on non-Windows platforms.
// Covered at the unit level by normalizePath() behavior; no e2e scenario possible here.
