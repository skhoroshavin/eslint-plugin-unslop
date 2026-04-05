# Test Conventions Spec

## Philosophy

All tests in this repository are end-to-end. Every test exercises a rule through the public `RuleTester` interface. No test reaches into rule internals or tests helper functions directly. If an internal helper's behavior matters, it is covered implicitly by the rule test that depends on it.

Every test case is self-contained. All inputs — source code, file paths, settings, filesystem layout — are written inline in the test body. A reader must never scroll outside the test to understand what it does.

There is one shared test utility: `scenario()`. It is the only permitted way to write a rule test. It is the only export from `src/utils/test-fixtures/index.ts`. No other shared test helpers exist.

---

## The scenario() API

```typescript
import { scenario } from '../../utils/test-fixtures/index.js'
import rule from './index.js'

scenario('description of the behavior being tested', rule, {
  // --- Filesystem (optional) ---
  // Creates a real temp directory with these files before the test runs.
  // Required only when the rule reads the filesystem at lint time (no-false-sharing).
  // All paths are relative to the temp dir root.
  files: [
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/featureA/consumer.ts', content: "import { x } from '../shared'" },
  ],

  // --- Parser (optional) ---
  // Set to true when the code under test uses TypeScript syntax (type annotations,
  // interfaces, etc.). Uses @typescript-eslint/parser without a tsconfig project.
  // Do not set this just because the rule implementation is TypeScript.
  typescript: true,

  // --- ESLint settings (optional) ---
  // Passed as the settings object to RuleTester. Required for architecture rules.
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },

  // --- The code under test (required) ---
  // The source string that will be linted.
  code: "import { createUserRepo } from '../../repository/user/index.ts'",

  // --- Filename (optional) ---
  // When files: is absent, this is a plain string used as context.filename.
  // When files: is present, this is resolved relative to the temp dir.
  filename: 'src/models/user/index.ts',

  // --- Expected errors (optional) ---
  // If absent or empty, the scenario asserts no errors are reported (valid case).
  // Use messageId, not message strings, unless the message is dynamic.
  errors: [{ messageId: 'notAllowed' }],

  // --- Expected autofix output (optional) ---
  // The full source string after fix is applied.
  // Set to null explicitly to assert that no autofix is emitted.
  output: 'export function clamp(n) {\n  return Math.min(n, LIMIT)\n}\n\nconst LIMIT = 10',
})
```

### Parameter reference

| Parameter     | Required | Type                     | Purpose                                                                  |
| ------------- | -------- | ------------------------ | ------------------------------------------------------------------------ |
| `description` | yes      | `string`                 | Names the behavior being verified. Should read like a spec scenario.     |
| `rule`        | yes      | `Rule.RuleModule`        | The ESLint rule under test. Always imported from `./index.js`.           |
| `files`       | no       | `Array<{path, content}>` | Real files written to a temp dir. Only for filesystem-scanning rules.    |
| `typescript`  | no       | `boolean`                | Enable TypeScript parser. Use when code contains TS syntax.              |
| `settings`    | no       | `object`                 | ESLint settings block. Required for architecture rules.                  |
| `code`        | yes      | `string`                 | The source code to lint.                                                 |
| `filename`    | no       | `string`                 | The filename context. Resolved against temp dir when `files` is present. |
| `errors`      | no       | `Array<{messageId}>`     | Expected errors. Absent or empty means the case is valid.                |
| `output`      | no       | `string \| null`         | Expected post-fix source. `null` asserts no fix is emitted.              |

---

## Worked examples

### Simple autofix rule (no-unicode-escape)

```typescript
scenario('basic ASCII escape is replaced with literal character', rule, {
  code: 'const x = "\\u0041";',
  errors: [{ messageId: 'preferLiteral' }],
  output: 'const x = "A";',
})

scenario('literal unicode character is allowed', rule, {
  code: 'const value = "—";',
})
```

No `files`, no `settings`, no `typescript`. All inputs visible on the first read.

### Policy rule with settings (import-control)

```typescript
scenario('cross-module import declared in allowlist is allowed', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: '/project/src/repository/user/service.ts',
  code: "import { UserModel } from '../../models/user/index.ts'",
})

scenario('cross-module import not declared in allowlist is reported', rule, {
  settings: {
    unslop: {
      sourceRoot: 'src',
      architecture: {
        'repository/*': { imports: ['models/*'] },
        'models/*': { imports: [] },
      },
    },
  },
  filename: '/project/src/models/user/index.ts',
  code: "import { createUserRepo } from '../../repository/user/index.ts'",
  errors: [{ messageId: 'notAllowed' }],
})
```

Settings are written inline. No shared constant for `settings` unless it is identical across 3+ scenarios in the same file.

### Filesystem-scanning rule (no-false-sharing)

```typescript
scenario('shared file only used by one directory raises false-sharing error', rule, {
  files: [
    { path: 'tsconfig.json', content: '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}' },
    { path: 'src/shared/index.ts', content: 'export const x = 1' },
    { path: 'src/featureA/consumerA.ts', content: "import { x } from '../shared'" },
    { path: 'src/featureA/consumerB.ts', content: "import { x } from '../shared'" },
  ],
  settings: {
    unslop: { sourceRoot: 'src', architecture: { shared: { shared: true } } },
  },
  code: 'export const x = 1',
  filename: 'src/shared/index.ts',
  errors: [{ messageId: 'notTrulyShared' }],
})
```

All filesystem state is declared in `files`. The `code` is the content of the file being linted. The `filename` is resolved against the temp dir automatically.

### TypeScript syntax (read-friendly-order)

```typescript
scenario('type declaration placed above its consumer is flagged', rule, {
  typescript: true,
  code: ['type Build<T> = { value: T }', '', 'export type PublicUser = Build<User>'].join('\n'),
  errors: [{ messageId: 'moveHelperBelow' }],
})
```

---

## What NOT to do

### Do not create assertion wrappers

```typescript
// WRONG — hides what assertion is being made
function assertValid(file: string) {
  makeTsRuleTester(SHARED_SETTINGS).run(rule, {
    valid: [{ code: fixture.read(file), filename: fixture.filePath(file) }],
    invalid: [],
  })
}

// RIGHT — use scenario() directly
scenario('shared file used by two directories is allowed', rule, {
  files: [...],
  settings: SHARED_SETTINGS,
  code: 'export const x = 1',
  filename: 'src/shared/index.ts',
})
```

### Do not declare module-scope fixture objects

```typescript
// WRONG — lifecycle hidden in beforeEach/afterAll, reader must scroll
const fixture = new ProjectFixture({ prefix: 'test-', files: [...] })
beforeEach(() => { fixture.init() })
afterAll(() => { fixture.cleanup() })

// RIGHT — scenario() manages temp dir lifetime internally when files: is set
scenario('...', rule, { files: [...], ... })
```

### Do not extract code strings into named constants unless shared across 3+ scenarios

```typescript
// WRONG — reader must scroll to understand what EXPORT_X contains
const EXPORT_X = 'export const x = 1'
scenario('...', rule, { code: EXPORT_X, ... })

// RIGHT — inline it
scenario('...', rule, { code: 'export const x = 1', ... })
```

### Do not write unit tests for internal helpers

```typescript
// WRONG — tests an internal function, not the rule's public behavior
import { matchFileToArchitectureModule } from './architecture-policy.js'
test('prefers exact matcher over wildcard', () => {
  expect(matchFileToArchitectureModule(...)).toMatchObject(...)
})

// RIGHT — write a scenario() for the rule that depends on this behavior
scenario('exact module matcher takes precedence over wildcard matcher', rule, {
  settings: { unslop: { sourceRoot: 'src', architecture: {
    'repository/*': { imports: [] },
    'repository/special': { imports: ['models/*'] },
  }}},
  filename: '/project/src/repository/special/index.ts',
  code: "import { x } from '../../models/user/index.ts'",
})
```

### Do not add exports to test-fixtures/index.ts

The file exports exactly one thing: `scenario`. Adding a second export requires updating this spec first and getting explicit agreement. The bar for a new shared export is: it must be needed by 3+ test files and cannot be composed from `scenario`.

---

## Spec coverage rule

Each named scenario in `openspec/specs/<rule>/spec.md` must have at least one corresponding `scenario()` call in the rule's test file. The test description should mirror the spec scenario name closely enough that the mapping is obvious.

When a spec scenario is not yet implemented, add a `scenario.todo()` call:

```typescript
scenario.todo('zero-width space is removed by autofix')
```

This keeps the gap visible without leaving the spec untracked.

---

## Naming convention

Test descriptions should read as behavior statements, not as implementation labels.

```
GOOD: 'cross-module import not declared in allowlist is reported'
GOOD: 'shared file used by one directory raises false-sharing error'
GOOD: 'helper declared above its consumer is moved below by autofix'

BAD:  'test 1'
BAD:  'autofix: basic ASCII escape with double quotes'
BAD:  'dir-mode shared file single folder invalid'
```
