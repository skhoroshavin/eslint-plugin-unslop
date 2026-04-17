# eslint-plugin-unslop

ESLint plugin for architecture enforcement and code quality. Define module boundaries, control imports and exports, catch false sharing and single-use constants, and fix common LLM-generated code smells - all from a single shared configuration.

Requires ESLint 9+ (flat config). TypeScript optional but recommended.

## Installation

```bash
npm install --save-dev eslint-plugin-unslop
```

## Quick Start

The `full` config enables the complete rule suite:

```js
// eslint.config.mjs
import unslop from 'eslint-plugin-unslop'

export default [
  unslop.configs.full,
  {
    settings: {
      unslop: {
        architecture: {
          utils: { shared: true },
          'repository/*': {
            imports: ['utils', 'models/+'],
            exports: ['^create\\w+Repo$', '^Repository[A-Z]\\w+$'],
          },
          models: {
            imports: ['utils'],
          },
          app: {
            imports: ['*'],
          },
        },
      },
    },
  },
]
```

Architecture rules (`import-control`, `no-whitebox-testing`, `export-control`, `no-false-sharing`, `no-single-use-constants`) require a reachable `tsconfig.json`. Set `compilerOptions.rootDir`, and if you use aliases, configure `compilerOptions.paths`.

| Rule                             | What it does                                                           |
| -------------------------------- | ---------------------------------------------------------------------- |
| `unslop/import-control`          | Enforces module boundaries and forbids local namespace imports         |
| `unslop/no-whitebox-testing`     | Keeps tests on module entrypoints instead of same-folder internals     |
| `unslop/export-control`          | Restricts export patterns and forbids `export *` in module entrypoints |
| `unslop/no-false-sharing`        | Flags shared entrypoint symbols with fewer than two consumer groups    |
| `unslop/no-single-use-constants` | Flags module-scope constants used once or never across the project     |
| `unslop/no-special-unicode`      | Catches smart quotes, invisible spaces, and other unicode impostors    |
| `unslop/no-unicode-escape`       | Prefers `"©"` over `"\u00A9"`                                          |
| `unslop/read-friendly-order`     | Enforces top-down, dependency-friendly declaration order               |

The `minimal` config contains only the zero-config symbol fixers (`no-special-unicode` and `no-unicode-escape`) for projects that don't need architecture enforcement:

```js
// eslint.config.mjs
import unslop from 'eslint-plugin-unslop'

export default [unslop.configs.minimal]
```

## Architecture Settings

All architecture rules read from `settings.unslop.architecture`. Each file first resolves to a canonical module path equal to its containing directory relative to the source root from `tsconfig.json`.

- `src/index.ts` -> `.`
- `src/models/index.ts` -> `models`
- `src/models/user/index.ts` -> `models/user`
- `src/models/user/internal.ts` -> `models/user`

Architecture keys are directory-shaped subtree selectors:

- `.` matches the source-root module
- `models` owns `models` and everything below it
- `models/*` owns each direct child subtree under `models`, such as `models/user` and `models/user/internal`

File-shaped keys like `index.ts` or `rules/public.ts` are not supported.

Each value is a policy object:

```ts
{
  imports?: string[]      // exact module, direct child via /*, self-or-child via /+, or '*' for all
  typeImports?: string[]  // same patterns as imports, but only for type-only imports
  exports?: string[]      // regex patterns symbols exported from entrypoints must match
  entrypoints?: string[]  // public files allowed for external and test imports
  shared?: boolean        // marks module as shared; enables no-false-sharing
}
```

`typeImports` defaults to `[]` when omitted. Type-only imports are also allowed when the target matches `imports`, so `typeImports` is only needed for modules you want to allow type access to without allowing value imports.

Architecture keys and import allowlists use different matching rules:

- keys assign ownership to subtrees
- `imports: ['models']` allows only the exact `models` module
- `imports: ['models/*']` allows only direct children like `models/user`
- `imports: ['models/+']` allows `models` and direct children like `models/user`

When multiple keys cover the same canonical module path, the winner is chosen by nearest owner first, then exact named path over wildcard path at the same depth, then longer selector path, then declaration order. Unmatched canonical module paths become anonymous modules with empty `imports`, empty `typeImports`, empty `exports`, `shared: false`, and default `entrypoints: ['index.ts']`.

All architecture rules take no options. Policy comes entirely from this shared settings block.

## Rules

### `unslop/import-control`

Customs control for your modules: you declare which modules are allowed to import from which, and anything undeclared gets turned away at the border.

Deny-by-default for cross-module imports, so forgetting to declare a dependency is a loud error rather than a silent free-for-all. It also enforces:

- cross-module imports must arrive through the public gate (configured entrypoints)
- type-only imports can be separately allowed via `typeImports` (value imports from those modules remain forbidden)
- local cross-module namespace imports are forbidden (`import * as X from '<local-module>'`)
- same-module relative imports can only go one level deeper - no tunnelling into internals
- files that don't match any declared module become anonymous modules and are denied by default

Alias imports are resolved via `compilerOptions.paths` from `tsconfig.json`.

### `unslop/no-whitebox-testing`

Keeps test files black-boxed. When a recognized test file lives beside a module's implementation, it must import that module through its public entrypoint (`.`, `./index`, or a configured `entrypoints` file) instead of reaching into sibling files like `./model.ts`.

This rule only checks recognized test filenames (`*.test.*`, `*.spec.*`, `*.*-test.*`, `*.*-spec.*`). Child submodule imports and cross-module imports are left to `unslop/import-control`.

### `unslop/export-control`

The customs declaration form for the other direction: what are you actually exporting from your module's public entrypoints?

When a module defines `exports` regex patterns, every symbol exported from its entrypoints must match at least one pattern - otherwise it's stopped at the gate. Modules without `exports` are waved through by default, so you can adopt this gradually. Regardless of module policy, `export * from ...` is rejected in public entrypoints so symbol provenance stays explicit.

### `unslop/no-false-sharing`

The "shared" folder anti-pattern detector. LLMs (and some humans) love creating shared APIs that are only used by one consumer - or worse, by nobody at all. This rule evaluates symbols exported from shared module entrypoints and requires each to be imported by at least two separate directory-level consumer groups. If a symbol is used in only one place, it's not shared - it's misplaced.

Mark a module as shared via `shared: true`:

```js
settings: {
  unslop: {
    architecture: {
      utils: { shared: true },
      shared: { shared: true },
    },
  },
}
```

Consumer counting is at the directory level: the importer file path relative to the source root derived from `tsconfig.json`, minus filename. Both value imports and `import type` imports count, and alias imports from `compilerOptions.paths` are resolved the same as relative imports.

```
src/shared/index.ts
  export const formatDate = ...
  -> imported only by src/features/calendar/view.ts
  -> error: symbol "formatDate" has 1 consumer group(s) (group: features/calendar)

src/shared/index.ts
  export type LegacyOptions = ...
  -> not imported by anyone
  -> error: symbol "LegacyOptions" has 0 consumer group(s) (no consumers found)
```

### `unslop/no-single-use-constants`

Flags module-scope `const` declarations that are used once or never across the entire project. LLM-generated code loves to extract magic values into constants that are then referenced a single time - adding indirection without improving clarity. If a constant isn't actually reused, inline it or delete it.

Non-exported constants are counted locally via scope analysis. Exported constants are counted project-wide using the TypeScript program, so cross-file usage is detected. Function and class-expression initializers are ignored - only real value constants are checked.

```js
// Bad - defined once, used once
const MAX_RETRIES = 3
function fetchWithRetry() {
  return retry(MAX_RETRIES)
}

// Good - inline it
function fetchWithRetry() {
  return retry(3)
}
```

### `unslop/read-friendly-order`

Enforces a top-down reading order. The idea: when someone opens a file, they should see the important stuff first and the helpers below. LLM-generated code often scatters declarations in random order, making files harder to follow.

**Top-level ordering** - Public/exported symbols should come before the private helpers they use. Read the API first, implementation details second.

```js
// Bad - helper defined before its consumer
function formatName(name) {
  return name.trim().toLowerCase()
}

export function createUser(name) {
  return { name: formatName(name) }
}

// Good - consumer first, helper below
export function createUser(name) {
  return { name: formatName(name) }
}

function formatName(name) {
  return name.trim().toLowerCase()
}
```

**Class member ordering** - Constructor first, public fields next, then other members ordered by dependency.

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

**Test file ordering** - Setup hooks (`beforeEach`, `beforeAll`) before teardown hooks (`afterEach`, `afterAll`), and both before test cases.

```js
// Bad - setup and tests buried between helpers
function buildFixture(overrides) {
  return { id: 1, ...overrides }
}
it('works', () => {
  /* ... */
})
beforeEach(() => {
  buildFixture()
})

// Good - setup first, then tests, helpers at the bottom
beforeEach(() => {
  buildFixture()
})
it('works', () => {
  /* ... */
})
function buildFixture(overrides) {
  return { id: 1, ...overrides }
}
```

### `unslop/no-special-unicode`

Disallows special unicode punctuation and whitespace characters in string and template literals. LLMs love to sprinkle in smart quotes (`“like this”`), non-breaking spaces, and other invisible gremlins that look fine in a PR review but cause fun bugs at runtime.

Caught characters include: smart quotes (`“” ‘’`), non-breaking space, en/em dash, horizontal ellipsis, zero-width space, and various other exotic whitespace.

```js
// Bad - these contain invisible special characters that look normal
const greeting = 'Hello World' // a non-breaking space (U+00A0) is hiding between the words
const quote = 'He said “hello”' // smart double quotes (U+201C, U+201D)

// Good
const greeting = 'Hello World' // regular ASCII space
const quote = 'He said "hello"' // plain ASCII quotes
```

Note: the bad examples above contain actual unicode characters that may be indistinguishable from their ASCII counterparts in your font - that's exactly the problem this rule catches.

### `unslop/no-unicode-escape`

Prefers actual characters over `\uXXXX` escape sequences. If your string says `\u00A9`, just write `©` - your coworkers will thank you.

```js
// Bad
const copyright = '\u00A9 2025'
const arrow = '\u2192'

// Good
const copyright = '© 2025'
const arrow = '→'
```

## A Note on Provenance

Yes, a fair amount of this was vibe-coded with LLM assistance - which is fitting, since that's exactly the context this plugin is designed for. That said, the ideas behind these rules, the decisions about what to catch and how to catch it, and the overall design are mine. Every piece of code went through human review, and the test cases in particular were written and verified with deliberate care.

The project also dogfoods itself: `eslint-plugin-unslop` is linted using `eslint-plugin-unslop`.

## Contributing

See [AGENTS.md](./AGENTS.md) for development setup and guidelines.

## License

[MIT](./LICENSE)
