import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: architecture-import-export-control/spec.md
// spec: no-false-sharing-symbol-analysis/spec.md

const TSCONFIG = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}',
}

const SHARED_SETTINGS = {
  unslop: {
    sourceRoot: 'src',
    architecture: {
      'ui/components': { shared: true },
      'feature-a/*': { imports: [] },
      'feature-b/*': { imports: [] },
    },
  },
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
  settings: SHARED_SETTINGS,
  filename: 'src/ui/components/index.ts',
  code: 'export const Button = 1',
})

scenario('exported symbol has two distinct consumers', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Card = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Card } from '@/ui/components'" },
    { path: 'src/feature-b/screen.ts', content: "import { Card } from '@/ui/components'" },
  ],
  settings: SHARED_SETTINGS,
  filename: 'src/ui/components/index.ts',
  code: 'export const Card = 1',
})

scenario('exported symbol has one consumer group', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  settings: SHARED_SETTINGS,
  filename: 'src/ui/components/index.ts',
  code: 'export const Button = 1',
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
  settings: SHARED_SETTINGS,
  filename: 'src/ui/components/index.ts',
  code: 'export const Input = 1',
  errors: [
    {
      message:
        'symbol "Input" has 1 consumer group(s) (group: feature-a) -> Must be used by 2+ entities',
    },
  ],
})

scenario('zero-consumer symbol report indicates no consumers', rule, {
  files: [TSCONFIG, { path: 'src/ui/components/index.ts', content: 'export const Toast = 1' }],
  settings: SHARED_SETTINGS,
  filename: 'src/ui/components/index.ts',
  code: 'export const Toast = 1',
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
  settings: SHARED_SETTINGS,
  filename: 'src/ui/components/types.ts',
  code: 'export type ButtonProps = { label: string }',
})

scenario('module not marked shared is exempt from false-sharing enforcement', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'ui/components': {},
      },
    },
  },
  filename: 'src/ui/components/index.ts',
  code: 'export const Button = 1',
})

scenario('missing sourceRoot in settings fails gracefully without reporting', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  settings: { unslop: { architecture: { 'ui/components': { shared: true } } } },
  filename: 'src/ui/components/index.ts',
  code: 'export const Button = 1',
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  files: [
    TSCONFIG,
    { path: 'src/ui/components/index.ts', content: 'export const Button = 1' },
    { path: 'src/feature-a/screen.ts', content: "import { Button } from '@/ui/components'" },
  ],
  settings: { unslop: { sourceRoot: 'src' } },
  filename: 'src/ui/components/index.ts',
  code: 'export const Button = 1',
})
