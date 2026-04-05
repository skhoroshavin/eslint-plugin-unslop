import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: architecture-import-export-control/spec.md (shared: true behavior)

const TSCONFIG = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}',
}
const SHARED_SETTINGS = {
  unslop: { sourceRoot: 'src', architecture: { shared: { shared: true } } },
}

scenario(
  'file not marked as shared is never checked regardless of how many consumers it has',
  rule,
  {
    files: [
      TSCONFIG,
      { path: 'src/featureA/util.ts', content: 'export const x = 1' },
      { path: 'src/featureB/consumer.ts', content: "import { x } from '../featureA/util'" },
    ],
    settings: SHARED_SETTINGS,
    filename: 'src/featureA/util.ts',
    code: 'export const x = 1',
  },
)

scenario('shared file imported by two different directories has no error', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
    { path: 'src/featureB/consumer.ts', content: "import { x } from '../shared'" },
  ],
  settings: SHARED_SETTINGS,
  filename: 'src/shared/index.ts',
  code: 'export const x = 1',
})

scenario('shared file only imported by files in one directory raises false-sharing error', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
    { path: 'src/featureA/consumerB.ts', content: "import { x } from '../shared'" },
  ],
  settings: SHARED_SETTINGS,
  filename: 'src/shared/index.ts',
  code: 'export const x = 1',
  errors: [{ messageId: 'notTrulyShared' }],
})

scenario(
  'test files do not count as consumers — one non-test dir plus test files still raises error',
  rule,
  {
    files: [
      TSCONFIG,
      { path: 'src/shared/index.ts', content: 'export const x = 1' },
      { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
      { path: 'src/featureB/consumer.test.ts', content: "import { x } from '../shared'" },
      { path: 'src/featureC/consumer.test.ts', content: "import { x } from '../shared'" },
    ],
    settings: SHARED_SETTINGS,
    filename: 'src/shared/index.ts',
    code: 'export const x = 1',
    errors: [{ messageId: 'notTrulyShared' }],
  },
)

scenario(
  'test files do not prevent valid cases — two non-test dirs plus a test file has no error',
  rule,
  {
    files: [
      TSCONFIG,
      { path: 'src/shared/index.ts', content: 'export const x = 1' },
      { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
      { path: 'src/featureB/consumer.ts', content: "import { x } from '../shared'" },
      { path: 'src/featureC/consumer.test.ts', content: "import { x } from '../shared'" },
    ],
    settings: SHARED_SETTINGS,
    filename: 'src/shared/index.ts',
    code: 'export const x = 1',
  },
)

scenario('different subdirectories within a top-level folder count as distinct consumers', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/rules/import-control/consumer.ts', content: "import { x } from '../../shared'" },
    { path: 'src/rules/export-control/consumer.ts', content: "import { x } from '../../shared'" },
  ],
  settings: SHARED_SETTINGS,
  filename: 'src/shared/index.ts',
  code: 'export const x = 1',
})

scenario('missing sourceRoot in settings fails gracefully without reporting', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
  ],
  settings: { unslop: { architecture: { shared: { shared: true } } } },
  filename: 'src/shared/index.ts',
  code: 'export const x = 1',
})

scenario('missing architecture settings fails gracefully without reporting', rule, {
  files: [
    TSCONFIG,
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
  ],
  settings: { unslop: { sourceRoot: 'src' } },
  filename: 'src/shared/index.ts',
  code: 'export const x = 1',
})
