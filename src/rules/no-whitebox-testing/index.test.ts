import node_path from 'node:path'

import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: no-whitebox-testing/spec.md

const TSCONFIG_WITH_ROOT_DIR = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"rootDir":"./src"}}',
}

const VIRTUAL_TEST_FILE = '/virtual/unslop/src/module/some.test.ts'

function missingTsconfigMessage(filename: string): string {
  return `TypeScript project context unavailable for "${filename}". No tsconfig.json found while searching from "${node_path.dirname(filename)}".`
}

scenario('recognized some.test.ts file is checked', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'usePublicEntrypoint',
      data: { specifier: './model.ts' },
    },
  ],
  output: null,
})

scenario('recognized some.spec.ts file is checked', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.spec.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.spec.ts',
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'usePublicEntrypoint',
      data: { specifier: './model.ts' },
    },
  ],
  output: null,
})

scenario('recognized some.unit-test.ts file is checked', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.unit-test.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.unit-test.ts',
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'usePublicEntrypoint',
      data: { specifier: './model.ts' },
    },
  ],
  output: null,
})

scenario('recognized some.unit-spec.ts file is checked', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.unit-spec.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.unit-spec.ts',
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'usePublicEntrypoint',
      data: { specifier: './model.ts' },
    },
  ],
  output: null,
})

scenario('non-test file is ignored', rule, {
  files: [TSCONFIG_WITH_ROOT_DIR, { path: 'src/module/some.ts' }, { path: 'src/module/model.ts' }],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.ts',
  code: "import { model } from './model.ts'",
})

scenario('test imports same-directory private sibling file', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [], entrypoints: ['index.ts'] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'usePublicEntrypoint',
      data: { specifier: './model.ts' },
    },
  ],
  output: null,
})

scenario('report includes offending import specifier', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'usePublicEntrypoint',
      data: { specifier: './model.ts' },
    },
  ],
  output: null,
})

scenario('test imports default index entrypoint through dot specifier', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { api } from '.'",
})

scenario('test imports default index entrypoint through explicit index specifier', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { api } from './index'",
})

scenario('test imports configured non-index entrypoint', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/public.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [], entrypoints: ['public.ts'] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { api } from './public.ts'",
})

scenario('test imports child submodule entrypoint', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/submodule/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { child } from './submodule'",
})

scenario('test imports child submodule internal file', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/submodule/other.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { child } from './submodule/other.ts'",
})

scenario('test imports another module', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/other/index.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
        other: { imports: [] },
      },
    },
  },
  filename: 'src/module/some.test.ts',
  code: "import { other } from '../other/index.ts'",
})

scenario('missing architecture settings', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    { path: 'src/module/some.test.ts' },
    { path: 'src/module/model.ts' },
  ],
  settings: {
    unslop: {},
  },
  filename: 'src/module/some.test.ts',
  code: "import { model } from './model.ts'",
})

scenario('semantic project unavailable', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/outside/tsconfig.json',
      content: '{',
    },
    { path: 'src/outside/module/some.test.ts' },
    { path: 'src/outside/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/outside/module/some.test.ts',
  code: "import { model } from './model.ts'",
  errors: [{ messageId: 'configurationError' }],
})

scenario('discovered tsconfig that excludes linted test file reports configuration error', rule, {
  files: [
    TSCONFIG_WITH_ROOT_DIR,
    {
      path: 'src/outside/tsconfig.json',
      content: '{"compilerOptions":{"rootDir":"."},"include":["support/**/*.ts"]}',
    },
    { path: 'src/outside/module/some.test.ts' },
    { path: 'src/outside/module/model.ts' },
  ],
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: 'src/outside/module/some.test.ts',
  code: "import { model } from './model.ts'",
  errors: [{ messageId: 'configurationError' }],
})

scenario('missing tsconfig reports linted file and search root', rule, {
  settings: {
    unslop: {
      architecture: {
        module: { imports: [] },
      },
    },
  },
  filename: VIRTUAL_TEST_FILE,
  code: "import { model } from './model.ts'",
  errors: [
    {
      messageId: 'configurationError',
      data: { details: missingTsconfigMessage(VIRTUAL_TEST_FILE) },
    },
  ],
})
