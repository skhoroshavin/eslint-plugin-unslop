import { test, expect } from 'vitest'
import { matchFileToArchitectureModule, normalizePath } from './architecture-policy.js'

test('prefers exact matcher over wildcard matcher', () => {
  const policy = {
    modules: [
      { matcher: 'repository/*', order: 0, policy: { imports: [], exports: [], shared: false } },
      {
        matcher: 'repository/special',
        order: 1,
        policy: { imports: [], exports: [], shared: false },
      },
    ],
  }

  expect(
    matchFileToArchitectureModule('/tmp/project/repository/special/index.ts', policy),
  ).toMatchObject({
    matcher: 'repository/special',
  })
})

test('supports wildcard instance matching', () => {
  const policy = {
    modules: [
      { matcher: 'models/*', order: 0, policy: { imports: [], exports: [], shared: false } },
    ],
  }

  expect(matchFileToArchitectureModule('/tmp/project/models/user/index.ts', policy)).toMatchObject({
    instance: 'models/user',
  })
})

test('respects sourceRoot when matching', () => {
  const policy = {
    sourceRoot: 'src',
    modules: [{ matcher: 'utils', order: 0, policy: { imports: [], exports: [], shared: true } }],
  }

  expect(matchFileToArchitectureModule('/tmp/project/src/utils/path.ts', policy)).toMatchObject({
    matcher: 'utils',
  })
})

test('normalizes windows style path separators', () => {
  expect(normalizePath('a\\b\\c.ts')).toBe('a/b/c.ts')
})
