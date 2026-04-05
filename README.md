# eslint-plugin-unslop

ESLint plugin that catches common LLM-generated code smells — the kind of subtle junk that sneaks in when your LLM is feeling creative. Smart quotes, invisible unicode, spaghetti imports, dead "shared" code that nobody shares, and declarations ordered for machines instead of humans.

Requires ESLint 9+ (flat config). TypeScript optional but recommended.

## Installation

```bash
npm install --save-dev eslint-plugin-unslop
```

## Quick Start

The recommended config enables the two most universal rules out of the box:

```js
// eslint.config.mjs
import unslop from 'eslint-plugin-unslop'

export default [unslop.configs.recommended]
```

This turns on:

| Rule                        | Severity | What it does                                                        |
| --------------------------- | -------- | ------------------------------------------------------------------- |
| `unslop/no-special-unicode` | error    | Catches smart quotes, invisible spaces, and other unicode impostors |
| `unslop/no-unicode-escape`  | error    | Prefers `"©"` over `"\u00A9"`                                       |

The remaining rules need explicit configuration:

```js
// eslint.config.mjs
import unslop from 'eslint-plugin-unslop'

export default [
  unslop.configs.recommended,
  {
    rules: {
      'unslop/no-false-sharing': ['error', { dirs: ['shared', 'utils'] }],
      'unslop/read-friendly-order': 'warn',
    },
  },
]
```

## Rules

### `unslop/no-special-unicode`

**Recommended**

Disallows special unicode punctuation and whitespace characters in string literals and template literals. LLMs love to sprinkle in smart quotes (`“like this”`), non-breaking spaces, and other invisible gremlins that look fine in a PR review but cause fun bugs at runtime.

Caught characters include: left/right smart quotes (`“” ‘’`), non-breaking space, en/em dash, horizontal ellipsis, zero-width space, and various other exotic whitespace.

```js
// Bad — these contain invisible special characters that look normal
const greeting = 'Hello World' // a non-breaking space (U+00A0) is hiding between the words
const quote = 'He said “hello”' // smart double quotes (U+201C, U+201D)

// Good
const greeting = 'Hello World' // regular ASCII space
const quote = 'He said "hello"' // plain ASCII quotes
```

Note: the bad examples above contain actual unicode characters that may be
indistinguishable from their ASCII counterparts in your font — that's exactly
the problem this rule catches.

### `unslop/no-unicode-escape`

**Recommended**

Prefers actual characters over `\uXXXX` escape sequences. If your string says `\u00A9`, just write `©` — your coworkers will thank you. LLM-generated code sometimes encodes characters as escape sequences for no good reason.

```js
// Bad
const copyright = '\u00A9 2025'
const arrow = '\u2192'

// Good
const copyright = '© 2025'
const arrow = '→'
```

### `unslop/import-control`

Think of this as customs control for your modules — you declare which modules are allowed to import from which, and anything undeclared gets turned away at the border.

The rule reads from a shared policy in `settings.unslop.architecture`. It's deny-by-default for cross-module imports, which means forgetting to declare a dependency is a loud error rather than a silent free-for-all. It also enforces:

- cross-module imports must arrive through the public gate (`index.ts` or `types.ts`)
- same-module relative imports can only go one level deeper — no tunnelling into internals
- files that don't match any declared module are denied (fail-closed, not fail-silently)

#### Configuration

```js
// eslint.config.mjs
import unslop from 'eslint-plugin-unslop'

export default [
  {
    settings: {
      unslop: {
        sourceRoot: 'src',
        architecture: {
          utils: { shared: true },
          'repository/*': {
            imports: ['utils', 'models/*'],
            exports: ['^create\\w+Repo$', '^Repository[A-Z]\\w+$'],
          },
          'models/*': {
            imports: ['utils'],
          },
          app: {
            imports: ['*'],
          },
        },
      },
    },
    rules: {
      'unslop/import-control': 'error',
      'unslop/export-control': 'error',
    },
  },
]
```

### `unslop/export-control`

The customs declaration form for the other direction: what are you actually exporting from your module's public entrypoints?

When a module defines `exports` regex patterns in `settings.unslop.architecture`, every symbol exported from that module's `index.ts` or `types.ts` must match at least one pattern — otherwise it's stopped at the gate with an error at the export site. Modules without `exports` are waved through by default, so you can adopt this gradually.

### `unslop/no-false-sharing`

**Requires TypeScript parser with program**

The "shared" folder anti-pattern detector. LLMs love creating shared utilities that are only used by one consumer — or worse, by nobody at all. This rule requires that modules inside your designated shared directories are actually imported by at least two separate entities. If it's only used in one place, it's not shared — it's misplaced.

#### Options

```js
;[
  'error',
  {
    dirs: [{ path: 'shared' }, { path: 'utils', mode: 'file' }],
    mode: 'dir',
    sourceRoot: 'src',
  },
]
```

| Option        | Type              | Required | Description                                                                                  |
| ------------- | ----------------- | -------- | -------------------------------------------------------------------------------------------- |
| `dirs`        | `array`           | yes      | Directories to enforce sharing rules on                                                      |
| `dirs[].path` | `string`          | yes      | Directory path relative to `sourceRoot`                                                      |
| `dirs[].mode` | `'file' \| 'dir'` | no       | How to count consumers for this dir (overrides global `mode`)                                |
| `mode`        | `'file' \| 'dir'` | no       | Global consumer counting mode — `'file'` counts individual files, `'dir'` counts directories |
| `sourceRoot`  | `string`          | no       | Source directory relative to project root                                                    |

#### Setup

This rule requires `typescript-eslint` with type information:

```js
// eslint.config.mjs
import unslop from 'eslint-plugin-unslop'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  unslop.configs.recommended,
  {
    rules: {
      'unslop/no-false-sharing': [
        'error',
        {
          dirs: ['shared', 'utils'],
          sourceRoot: 'src',
        },
      ],
    },
  },
)
```

#### What it catches

```
src/shared/format-date.ts
  → only imported by src/features/calendar/view.ts
  → error: must be used by 2+ entities

src/utils/old-helper.ts
  → not imported by anyone
  → error: must be used by 2+ entities
```

### `unslop/read-friendly-order`

Enforces a top-down reading order for your code. The idea: when someone opens a file, they should see the important stuff first and the helpers below. LLM-generated code often scatters declarations in random order, making files harder to follow.

This rule covers three areas:

**Top-level ordering** — Public/exported symbols should come before the private helpers they use. Read the API first, implementation details second.

```js
// Bad — helper defined before its consumer
function formatName(name) {
  return name.trim().toLowerCase()
}

export function createUser(name) {
  return { name: formatName(name) }
}

// Good — consumer first, helper below
export function createUser(name) {
  return { name: formatName(name) }
}

function formatName(name) {
  return name.trim().toLowerCase()
}
```

**Class member ordering** — Constructor first, public fields next, then other members ordered by dependency.

```js
// Bad
class UserService {
  private format() { /* ... */ }
  name = 'default'
  constructor() { /* ... */ }
}

// Good
class UserService {
  constructor() { /* ... */ }
  name = 'default'
  private format() { /* ... */ }
}
```

**Test file ordering** — Setup hooks (`beforeEach`, `beforeAll`) before teardown hooks (`afterEach`, `afterAll`), and both before test cases.

```js
// Bad — setup and tests buried between helpers
function buildFixture(overrides) {
  return { id: 1, ...overrides }
}
it('works', () => {
  /* ... */
})
function assertCorrect(value) {
  expect(value).toBe(1)
}
beforeEach(() => {
  buildFixture()
})

// Good — setup first, then tests, helpers at the bottom
beforeEach(() => {
  buildFixture()
})
it('works', () => {
  /* ... */
})
function buildFixture(overrides) {
  return { id: 1, ...overrides }
}
function assertCorrect(value) {
  expect(value).toBe(1)
}
```

## A Note on Provenance

Yes, a fair amount of this was vibe-coded with LLM assistance — which is fitting, since that's exactly the context this plugin is designed for. That said, the ideas behind these rules, the decisions about what to catch and how to catch it, and the overall design are mine. Every piece of code went through human review, and the test cases in particular were written and verified with deliberate care.

The project also dogfoods itself: `eslint-plugin-unslop` is linted using `eslint-plugin-unslop`.

## Maintainer: Main Branch Protection

This repository treats `main` as a protected branch with pull-request-only merges.

Baseline policy:

- Require pull requests before merge
- Require at least 1 approving review
- Dismiss stale approvals when new commits are pushed
- Require branch to be up to date before merge
- Require status check: `PR Gate`
- Apply restrictions to admins too (`enforce_admins`)

The required check is produced by `.github/workflows/test.yml` (workflow/job name: `PR Gate`) and runs:

1. `npm run verify`
2. `npm run test`

### Safe Workflow Renames

If you rename the workflow or job that produces `PR Gate`, update branch protection required checks immediately to match the new check context.

Recommended update command:

```bash
gh api -X PUT repos/skhoroshavin/eslint-plugin-unslop/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -F 'required_status_checks[strict]=true' \
  -F 'required_status_checks[contexts][]=PR Gate' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews[dismiss_stale_reviews]=true' \
  -F 'required_pull_request_reviews[require_code_owner_reviews]=false' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'restrictions=null'
```

### Branch Protection Audit

Run these checks periodically:

```bash
gh api repos/skhoroshavin/eslint-plugin-unslop/branches/main/protection
gh run list --workflow "PR Gate" --limit 5
```

Expected audit outcomes:

- `required_status_checks.contexts` includes `PR Gate`
- `required_pull_request_reviews.required_approving_review_count` is `1` or greater
- `required_pull_request_reviews.dismiss_stale_reviews` is `true`
- `enforce_admins.enabled` is `true`

## Contributing

See [AGENTS.md](./AGENTS.md) for development setup and guidelines.

## License

[MIT](./LICENSE)
