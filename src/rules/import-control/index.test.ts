import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: architecture-import-export-control/spec.md

const TSCONFIG_WITH_ALIASES = {
  path: 'tsconfig.json',
  content:
    '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}},"include":["src/**/*.ts"]}',
}

const TSCONFIG_NO_ALIASES = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"baseUrl":"."},"include":["src/**/*.ts"]}',
}

scenario('cross-module import declared in the allowlist is allowed', rule, {
  files: [{ path: 'src/repository/user/service.ts' }, { path: 'src/models/user/index.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { UserModel } from '../../models/user/index.ts'",
})

scenario('cross-module alias import to entrypoint declared in the allowlist is allowed', rule, {
  files: [
    TSCONFIG_WITH_ALIASES,
    { path: 'src/repository/user/service.ts' },
    { path: 'src/models/user/index.ts' },
  ],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { UserModel } from '@/models/user/index.ts'",
})

scenario('alias import is ignored when tsconfig does not define that alias', rule, {
  files: [
    TSCONFIG_NO_ALIASES,
    { path: 'src/models/user/index.ts' },
    { path: 'src/repository/user/index.ts' },
  ],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/models/user/index.ts',
  code: "import { createUserRepo } from '@/repository/user/index.ts'",
})

scenario('alias import fallback still works without project configuration', rule, {
  files: [{ path: 'src/repository/user/service.ts' }, { path: 'src/models/user/index.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { UserModel } from '@/models/user/index.ts'",
})

scenario('cross-module import not declared in the allowlist is reported', rule, {
  files: [{ path: 'src/repository/user/index.ts' }, { path: 'src/models/user/index.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
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

scenario('cross-module import targeting an internal non-entrypoint file is reported', rule, {
  files: [{ path: 'src/repository/user/service.ts' }, { path: 'src/models/user/internal.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import { hidden } from '../../models/user/internal.ts'",
  errors: [{ messageId: 'nonEntrypoint' }],
})

scenario('local cross-module namespace import is rejected', rule, {
  files: [{ path: 'src/repository/user/service.ts' }, { path: 'src/models/user/index.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import * as UserModels from '../../models/user/index.ts'",
  errors: [{ messageId: 'namespaceLocalForbidden' }],
})

scenario('external dependency namespace import is allowed', rule, {
  files: [{ path: 'src/repository/user/service.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
      },
    },
  },
  filename: 'src/repository/user/service.ts',
  code: "import * as nodePath from 'node:path'\nvoid nodePath.sep",
})

scenario(
  'shallow relative import to a direct child module entrypoint is implicitly allowed',
  rule,
  {
    files: [{ path: 'src/index.ts' }, { path: 'src/rules/index.ts' }],
    settings: {
      unslop: {
        sourceRoot: 'src',
        architecture: {
          'index.ts': { imports: [] },
          'rules/index.ts': { imports: [] },
        },
      },
    },
    filename: 'src/index.ts',
    code: "import rules from './rules/index.ts'",
  },
)

scenario('shallow relative import to a direct child non-entrypoint is reported', rule, {
  files: [{ path: 'src/index.ts' }, { path: 'src/rules/internal.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'index.ts': { imports: [] },
        rules: { imports: [] },
      },
    },
  },
  filename: 'src/index.ts',
  code: "import x from './rules/internal.ts'",
  errors: [{ messageId: 'notAllowed' }],
})

scenario('same-module relative import one level deep is allowed', rule, {
  files: [
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/index.ts' },
  ],
  settings: {
    unslop: {
      sourceRoot: 'src',
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
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/internal/index.ts' },
  ],
  settings: {
    unslop: {
      sourceRoot: 'src',
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
    TSCONFIG_WITH_ALIASES,
    { path: 'src/repository/user/index.ts' },
    { path: 'src/repository/user/helpers/internal/index.ts' },
  ],
  settings: {
    unslop: {
      sourceRoot: 'src',
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
  files: [{ path: 'src/models/user/index.ts' }, { path: 'src/repository/user/index.ts' }],
  settings: {
    unslop: { sourceRoot: 'src' },
  },
  filename: 'src/models/user/index.ts',
  code: "import { createUserRepo } from '../../repository/user/index.ts'",
})

scenario('exact module matcher takes precedence over wildcard matcher', rule, {
  files: [{ path: 'src/repository/special/index.ts' }, { path: 'src/models/user/index.ts' }],
  settings: {
    unslop: {
      sourceRoot: 'src',
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

// Windows backslash path normalization is exercised by architecture-policy internals
// but cannot be triggered through context.filename on non-Windows platforms.
// Covered at the unit level by normalizePath() behavior; no e2e scenario possible here.
