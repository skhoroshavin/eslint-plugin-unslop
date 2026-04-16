import node_path from 'node:path'

import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: no-false-sharing/spec.md

const TSCONFIG = {
  path: 'tsconfig.json',
  content:
    '{"compilerOptions":{"strict":true,"rootDir":"./src","baseUrl":".","paths":{"@/*":["src/*"]}},"include":["**/*.ts"]}',
}

const SHARED_ARCHITECTURE = {
  'ui/components': { shared: true },
  'feature-a/*': { imports: [] },
  'feature-b/*': { imports: [] },
}

const VIRTUAL_SHARED_ENTRYPOINT = '/virtual/unslop/src/ui/components/index.ts'

function missingTsconfigMessage(filename: string): string {
  return `TypeScript project context unavailable for "${filename}". No tsconfig.json found while searching from "${node_path.dirname(filename)}".`
}

scenario('alias import counts as a symbol consumer', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
    {
      path: 'src/feature-b/screen.ts',
      content: "import { Button } from '@/ui/components/index'",
    },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
})

scenario('exported symbol has two distinct consumers', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Card = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Card } from '@/ui/components'" },
    { path: 'src/feature-b/screen.ts', content: "import { Card } from '@/ui/components'" },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
})

scenario('exported symbol has one consumer group', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
  errors: [
    {
      message:
        'symbol "Button" has 1 consumer group(s) (group: feature-a) -> Must be used by 2+ entities',
    },
  ],
})

scenario('single-consumer symbol report includes consumer group', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Input = 1' },
    { path: 'src/feature-a/form.ts', content: "import { Input } from '@/ui/components'" },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
  errors: [
    {
      message:
        'symbol "Input" has 1 consumer group(s) (group: feature-a) -> Must be used by 2+ entities',
    },
  ],
})

scenario('zero-consumer symbol report indicates no consumers', rule, {
  files: [TSCONFIG, { path: 'src/ui/components/index.ts', content: 'export const Toast = 1' }],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
  errors: [
    {
      message:
        'symbol "Toast" has 0 consumer group(s) (no consumers found) -> Must be used by 2+ entities',
    },
  ],
})

scenario('type-only imports satisfy sharing threshold', rule, {
  files: [
    TSCONFIG,
    {
      path: 'src/ui/components/types.ts',
      content: 'export type ButtonProps = { label: string }',
    },
    {
      path: 'src/feature-a/screen.ts',
      content:
        "import type { ButtonProps } from '@/ui/components/types'\nconst value: ButtonProps = { label: 'a' }\nvoid value",
    },
    {
      path: 'src/feature-b/screen.ts',
      content:
        "import type { ButtonProps } from '@/ui/components/types'\nconst value: ButtonProps = { label: 'b' }\nvoid value",
    },
  ],
  architecture: {
    'ui/components': { shared: true, entrypoints: ['types.ts'] },
    'feature-a/*': { imports: [] },
    'feature-b/*': { imports: [] },
  },
  filename: 'src/ui/components/types.ts',
})

scenario('configured shared non-index entrypoint is enforced', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/public.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components/public'" },
    { path: 'src/feature-b/screen.ts', content: "import { Button } from '@/ui/components/public'" },
  ],
  architecture: {
    'ui/components': { shared: true, entrypoints: ['public.ts'] },
    'feature-a/*': { imports: [] },
    'feature-b/*': { imports: [] },
  },
  filename: 'src/ui/components/public.ts',
})

scenario('direct entrypoint export counts internal shared consumers', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Badge = 1' },
    {
      path: 'src/ui/components/local-consumer.ts',
      content: "import { Badge } from '@/ui/components'\nvoid Badge",
    },
    { path: 'src/feature-a/screen.ts', content: "import { Badge } from '@/ui/components'" },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
})

scenario('re-exported symbol counts internal backing-file consumers', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: "export { helper } from './helper'" },
    { path: 'src/ui/components/helper.ts', content: 'export const helper = 1' },
    {
      path: 'src/ui/components/local-consumer.ts',
      content: "import { helper } from './helper'\nvoid helper",
    },
    { path: 'src/feature-a/screen.ts', content: "import { helper } from '@/ui/components'" },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
})

scenario('multiple internal consumers collapse to one shared-module group', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: "export { sharedThing } from './shared-thing'" },
    { path: 'src/ui/components/shared-thing.ts', content: 'export const sharedThing = 1' },
    {
      path: 'src/ui/components/local-a.ts',
      content: "import { sharedThing } from './shared-thing'\nvoid sharedThing",
    },
    {
      path: 'src/ui/components/local-b.ts',
      content: "import { sharedThing } from '@/ui/components'\nvoid sharedThing",
    },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
  errors: [
    {
      message:
        'symbol "sharedThing" has 1 consumer group(s) (group: internal:ui/components) -> Must be used by 2+ entities',
    },
  ],
})

scenario('internal-only consumer group remains insufficient', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: "export { localOnly } from './local-only'" },
    { path: 'src/ui/components/local-only.ts', content: 'export const localOnly = 1' },
    {
      path: 'src/ui/components/local-consumer.ts',
      content: "import { localOnly } from './local-only'\nvoid localOnly",
    },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
  errors: [
    {
      message:
        'symbol "localOnly" has 1 consumer group(s) (group: internal:ui/components) -> Must be used by 2+ entities',
    },
  ],
})

scenario('external deep imports of backing files do not satisfy sharing', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: "export { deepOnly } from './deep-only'" },
    { path: 'src/ui/components/deep-only.ts', content: 'export const deepOnly = 1' },
    {
      path: 'src/feature-a/screen.ts',
      content: "import { deepOnly } from '@/ui/components/deep-only'\nvoid deepOnly",
    },
    { path: 'src/feature-b/screen.ts', content: "import { deepOnly } from '@/ui/components'" },
  ],
  architecture: SHARED_ARCHITECTURE,
  filename: 'src/ui/components/index.ts',
  errors: [
    {
      message:
        'symbol "deepOnly" has 1 consumer group(s) (group: feature-b) -> Must be used by 2+ entities',
    },
  ],
})

scenario('missing tsconfig for linted file fails gracefully without reporting', rule, {
  files: [
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  architecture: { 'ui/components': { shared: true } },
  filename: 'src/ui/components/index.ts',
  errors: [{ messageId: 'configurationError' }],
})

scenario('semantic project setup failure fails open', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/tsconfig.json', content: '{' },
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  architecture: { 'ui/components': { shared: true } },
  filename: 'src/ui/components/index.ts',
  errors: [{ messageId: 'configurationError' }],
})

scenario(
  'discovered tsconfig that excludes linted shared entrypoint reports configuration error',
  rule,
  {
    files: [
      {
        path: 'src/ui/tsconfig.json',
        content: '{"compilerOptions":{"rootDir":"."},"include":["feature-a/support.ts"]}',
      },
      { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
      { path: 'src/ui/feature-a/support.ts', content: 'export const SUPPORT = 1' },
    ],
    architecture: { components: { shared: true } },
    filename: 'src/ui/components/index.ts',
    errors: [{ messageId: 'configurationError' }],
  },
)

scenario('missing tsconfig error includes linted file and search root', rule, {
  architecture: { 'ui/components': { shared: true } },
  filename: VIRTUAL_SHARED_ENTRYPOINT,
  code: 'export const Button = 1',
  errors: [
    {
      messageId: 'configurationError',
      data: { details: missingTsconfigMessage(VIRTUAL_SHARED_ENTRYPOINT) },
    },
  ],
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  filename: 'src/ui/components/index.ts',
})

scenario('unsupported architecture key selector reports a configuration error', rule, {
  files: [TSCONFIG, { path: 'src/ui/components/index.ts', content: 'export const Button = 1' }],
  architecture: { 'ui/+': { shared: true } },
  filename: 'src/ui/components/index.ts',
  errors: [{ messageId: 'configurationError' }],
})
