import { afterAll, beforeEach, test } from 'vitest'
import rule from './index.js'
import { ProjectFixture, ruleTester } from '../../utils/test-fixtures/index.js'

beforeEach(() => {
  fixture.init()
})

afterAll(() => {
  fixture.cleanup()
})

test('same-level and one level deep imports are valid', () => {
  ruleTester.run('no-deep-imports', rule, {
    valid: [
      {
        code: 'import { x } from "@/a/helper.js";',
        filename: fixture.filePath('a/index.ts'),
      },
      {
        code: 'import { x } from "@/a/child/index.js";',
        filename: fixture.filePath('a/index.ts'),
      },
      {
        code: 'import { x } from "./child/index.js";',
        filename: fixture.filePath('a/index.ts'),
      },
    ],
    invalid: [],
  })
})

test('two levels deep within same folder is blocked', () => {
  ruleTester.run('no-deep-imports', rule, {
    valid: [],
    invalid: [
      {
        code: 'import { x } from "@/a/child/deep/index.js";',
        filename: fixture.filePath('a/index.ts'),
        errors: [{ messageId: 'tooDeep' }],
      },
      {
        code: 'import { x } from "./child/deep/index.js";',
        filename: fixture.filePath('a/index.ts'),
        errors: [{ messageId: 'tooDeep' }],
      },
    ],
  })
})

test('deep imports in another top-level folder are ignored', () => {
  ruleTester.run('no-deep-imports', rule, {
    valid: [
      {
        code: 'import { x } from "@/b/other/deep/index.js";',
        filename: fixture.filePath('src/a/index.ts'),
      },
    ],
    invalid: [],
  })
})

test('sourceRoot override works with explicit src root', () => {
  ruleTester.run('no-deep-imports', rule, {
    valid: [
      {
        code: 'import { x } from "@/a/child/index.js";',
        filename: fixture.filePath('a/index.ts'),
      },
    ],
    invalid: [
      {
        code: 'import { x } from "@/a/child/deep/index.js";',
        filename: fixture.filePath('a/index.ts'),
        errors: [{ messageId: 'tooDeep' }],
      },
    ],
  })
})

const fixture = new ProjectFixture({
  prefix: 'depth-test-',
  files: [
    { path: 'a/index.ts' },
    { path: 'a/helper.ts' },
    { path: 'a/child/index.ts' },
    { path: 'a/child/deep/index.ts' },
    { path: 'b/other/deep/index.ts' },
  ],
})
