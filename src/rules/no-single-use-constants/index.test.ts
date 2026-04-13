import rule from './index.js'
import { scenario } from '../../utils/test-fixtures/index.js'

// spec: no-single-use-constants/spec.md

const TSCONFIG = {
  path: 'tsconfig.json',
  content: '{"compilerOptions":{"strict":true,"rootDir":"./src"},"include":["**/*.ts"]}',
}

// --- Requirement: no-single-use-constants SHALL report single-use module constants ---

scenario('module constant has no real uses is reported with count 0', rule, {
  code: 'const FOO = 1',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '0' } }],
})

scenario('module constant with exactly one real use is reported with count 1', rule, {
  code: 'const FOO = 1\nvoid FOO',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '1' } }],
})

scenario('module constant with two real uses is not reported', rule, {
  code: 'const FOO = 1\nvoid FOO\nvoid FOO',
})

// --- Requirement: no-single-use-constants SHALL exclude non-inlineable declarations ---

scenario('destructured const is ignored', rule, {
  code: 'const { foo } = { foo: 1 }',
})

scenario('array-destructured const is ignored', rule, {
  code: 'const [foo] = [1]',
})

scenario('function-valued const is ignored', rule, {
  code: 'const fn = function() { return 1 }',
})

scenario('arrow-function-valued const is ignored', rule, {
  code: 'const fn = () => 1',
})

scenario('class-valued const is ignored', rule, {
  code: 'const Cls = class {}',
})

scenario('declare const with no initializer is ignored', rule, {
  typescript: true,
  code: 'declare const FOO: string',
})

scenario('object literal initializer is ignored', rule, {
  code: "const STATUS_COLORS = { new: 'green', old: 'gray' }",
})

scenario('array literal initializer is reported when used once', rule, {
  code: "const OPTIONAL_SECTIONS = ['experience', 'education']\nvoid OPTIONAL_SECTIONS",
  errors: [{ messageId: 'singleUse', data: { name: 'OPTIONAL_SECTIONS', count: '1' } }],
})

scenario('constructor call initializer is ignored', rule, {
  code: "const EU_REGIONS = new Set(['westeurope'])",
})

scenario('generic factory call initializer is ignored', rule, {
  typescript: true,
  code:
    'interface MySchema {}\n' +
    'declare function createValidate<T>(): () => boolean\n' +
    'const validate = createValidate<MySchema>()\n' +
    'void validate',
})

// --- re-export and export-default do not count as uses ---

scenario('re-export does not count as a use', rule, {
  files: [TSCONFIG, { path: 'src/foo.ts', content: 'const FOO = 1\nexport { FOO }' }],
  filename: 'src/foo.ts',
  code: 'const FOO = 1\nexport { FOO }',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '0' } }],
})

scenario('aliased re-export does not count as a use', rule, {
  files: [TSCONFIG, { path: 'src/foo.ts', content: 'const FOO = 1\nexport { FOO as Bar }' }],
  filename: 'src/foo.ts',
  code: 'const FOO = 1\nexport { FOO as Bar }',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '0' } }],
})

scenario('export default identifier does not count as a use', rule, {
  files: [TSCONFIG, { path: 'src/foo.ts', content: 'const FOO = 1\nexport default FOO' }],
  filename: 'src/foo.ts',
  code: 'const FOO = 1\nexport default FOO',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '0' } }],
})

// --- Requirement: no-single-use-constants SHALL count project-wide semantic uses ---

scenario('exported constant used from another file counts that use', rule, {
  files: [
    TSCONFIG,
    { path: 'src/constants.ts', content: 'export const FOO = 1' },
    { path: 'src/consumer-a.ts', content: "import { FOO } from './constants'\nvoid FOO" },
    { path: 'src/consumer-b.ts', content: "import { FOO } from './constants'\nvoid FOO" },
  ],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
})

scenario('exported constant used only in one other file is reported', rule, {
  files: [
    TSCONFIG,
    { path: 'src/constants.ts', content: 'export const FOO = 1' },
    { path: 'src/consumer.ts', content: "import { FOO } from './constants'\nvoid FOO" },
  ],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '1' } }],
})

scenario('exported expression use counts toward total', rule, {
  files: [
    TSCONFIG,
    { path: 'src/constants.ts', content: 'export const FOO = 1' },
    {
      path: 'src/consumer.ts',
      content: "import { FOO } from './constants'\nexport const BAR = FOO + FOO",
    },
  ],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
})

scenario('import declaration does not count as a use', rule, {
  files: [
    TSCONFIG,
    { path: 'src/constants.ts', content: 'export const FOO = 1' },
    { path: 'src/consumer.ts', content: "import { FOO } from './constants'" },
  ],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
  errors: [{ messageId: 'singleUse', data: { name: 'FOO', count: '0' } }],
})

scenario('alias-based import and use counts as a real use', rule, {
  files: [
    TSCONFIG,
    { path: 'src/constants.ts', content: 'export const FOO = 1' },
    {
      path: 'src/consumer-a.ts',
      content: "import { FOO as MyFoo } from './constants'\nvoid MyFoo",
    },
    { path: 'src/consumer-b.ts', content: "import { FOO } from './constants'\nvoid FOO" },
  ],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
})

scenario('semantic project unavailable makes rule a no-op', rule, {
  files: [{ path: 'src/constants.ts', content: 'export const FOO = 1' }],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
})

// --- Requirement: Plugin SHALL read tsconfig.json to resolve project layout ---

scenario('tsconfig with extends resolves inherited options and counts uses', rule, {
  files: [
    { path: 'tsconfig.base.json', content: '{"compilerOptions":{"strict":true}}' },
    {
      path: 'tsconfig.json',
      content:
        '{"extends":"./tsconfig.base.json","compilerOptions":{"rootDir":"./src"},"include":["**/*.ts"]}',
    },
    { path: 'src/constants.ts', content: 'export const FOO = 1' },
    { path: 'src/consumer-a.ts', content: "import { FOO } from './constants'\nvoid FOO" },
    { path: 'src/consumer-b.ts', content: "import { FOO } from './constants'\nvoid FOO" },
  ],
  filename: 'src/constants.ts',
  code: 'export const FOO = 1',
})
