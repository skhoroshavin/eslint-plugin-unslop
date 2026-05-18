import node_path from 'node:path'

import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: no-unused-types/spec.md

const TSCONFIG = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"strict":true,"rootDir":"./src"},"include":["**/*.ts"]}',
}

const VIRTUAL_TYPES_FILE = '/virtual/unslop/src/types.ts'

function missingTsconfigMessage(filename: string): string {
  return `TypeScript project context unavailable for "${filename}". No tsconfig.json found while searching from "${node_path.dirname(filename)}".`
}

// --- Requirement: no-unused-types SHALL report exported types with zero project-wide uses ---

scenario('exported type alias with zero real uses is reported', rule, {
  typescript: true,
  files: [TSCONFIG, { path: 'src/types.ts', content: 'export type Foo = string' }],
  filename: 'src/types.ts',
  errors: [{ messageId: 'zeroUses', data: { name: 'Foo' } }],
})

scenario('exported interface with zero real uses is reported', rule, {
  typescript: true,
  files: [TSCONFIG, { path: 'src/types.ts', content: 'export interface Bar { a: number }' }],
  filename: 'src/types.ts',
  errors: [{ messageId: 'zeroUses', data: { name: 'Bar' } }],
})

scenario('exported type used in another file is not reported', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    { path: 'src/types.ts', content: 'export type Foo = string' },
    {
      path: 'src/consumer.ts',
      content: "import type { Foo } from './types'\nconst x: Foo = 'hello'",
    },
  ],
  filename: 'src/types.ts',
})

scenario('exported type used as type argument in another file is not reported', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    { path: 'src/types.ts', content: 'export type Foo = string' },
    {
      path: 'src/consumer.ts',
      content: "import type { Foo } from './types'\nconst x: Array<Foo> = ['hello']",
    },
  ],
  filename: 'src/types.ts',
})

scenario('exported type used in type annotation in another file is not reported', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    {
      path: 'src/types.ts',
      content: 'export type Foo = string',
    },
    {
      path: 'src/consumer.ts',
      content:
        "import type { Foo } from './types'\nexport function bar(input: Foo): string { return input }",
    },
  ],
  filename: 'src/types.ts',
})

// --- Requirement: no-unused-types SHALL exclude re-export and barrel positions ---

scenario('re-export of type does not count as a use', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    { path: 'src/types.ts', content: 'export type Foo = string' },
    {
      path: 'src/barrel.ts',
      content: "export type { Foo } from './types'",
    },
  ],
  filename: 'src/types.ts',
  errors: [{ messageId: 'zeroUses', data: { name: 'Foo' } }],
})

scenario('aliased re-export of type does not count as a use', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    { path: 'src/types.ts', content: 'export type Foo = string' },
    {
      path: 'src/barrel.ts',
      content: "export type { Foo as Bar } from './types'",
    },
  ],
  filename: 'src/types.ts',
  errors: [{ messageId: 'zeroUses', data: { name: 'Foo' } }],
})

// --- Requirement: no-unused-types SHALL count project-wide semantic uses ---

scenario('exported type imported and used in type annotation counts as use', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    { path: 'src/types.ts', content: 'export type Foo = string' },
    {
      path: 'src/consumer.ts',
      content:
        "import type { Foo } from './types'\nexport function bar(input: Foo): Foo { return input }",
    },
  ],
  filename: 'src/types.ts',
})

scenario('non-exported type alias is not checked', rule, {
  typescript: true,
  files: [TSCONFIG, { path: 'src/types.ts', content: 'type Internal = string' }],
  filename: 'src/types.ts',
})

scenario('non-exported interface is not checked', rule, {
  typescript: true,
  files: [
    TSCONFIG,
    {
      path: 'src/types.ts',
      content: 'interface Internal { a: number }',
    },
  ],
  filename: 'src/types.ts',
})

scenario('semantic project unavailable reports configuration error', rule, {
  typescript: true,
  filename: VIRTUAL_TYPES_FILE,
  code: 'export type Foo = string',
  errors: [
    {
      messageId: 'configurationError',
      data: { details: missingTsconfigMessage(VIRTUAL_TYPES_FILE) },
    },
  ],
})

scenario('file outside discovered tsconfig project reports configuration error', rule, {
  typescript: true,
  files: [
    {
      path: 'src/nested/tsconfig.json',
      content: '{"compilerOptions":{"rootDir":"."},"include":["support.ts"]}',
    },
    { path: 'src/nested/types.ts', content: 'export type Foo = string' },
    { path: 'src/nested/support.ts', content: 'export const SUPPORT = 1' },
  ],
  filename: 'src/nested/types.ts',
  errors: [{ messageId: 'configurationError' }],
})
