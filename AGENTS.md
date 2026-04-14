# AGENTS.md

Guidance for coding agents working in `eslint-plugin-unslop` — an ESLint plugin that flags low-quality, often LLM-generated code patterns.

## Stack

| Concern     | Tool                                      |
| ----------- | ----------------------------------------- |
| Package mgr | npm                                       |
| Runtime     | Node >= 18                                |
| Language    | TypeScript (strict, ESM)                  |
| Build       | tsup                                      |
| Lint        | ESLint v9 flat config + typescript-eslint |
| Format      | Prettier                                  |
| Tests       | Vitest + ESLint RuleTester                |

## Commands

| Task                | Command                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| Install             | `npm install`                                                                |
| Build               | `npm run build` (tsup)                                                       |
| Autofix             | `npm run fix` (knip --fix && eslint --fix && prettier --write)               |
| Verify              | `npm run verify` (prettier --check, knip, jscpd, tsc --noEmit, tsup, eslint) |
| Test                | `npm run test` (vitest run)                                                  |
| Test watch          | `npm run test:watch` (vitest)                                                |
| Single test file    | `npm run test -- src/rules/<rule>/index.test.ts`                             |
| Single test by name | `npm run test -- -t "description"`                                           |
| File + name combo   | `npx vitest run src/rules/<rule>/index.test.ts -t "description"`             |

## Repository Layout

```
src/index.ts                       plugin entrypoint + shareable configs
src/rules/index.ts                 rule registry
src/rules/<rule>/index.ts          rule implementation (default export)
src/rules/<rule>/*.test.ts         colocated tests
src/rules/read-friendly-order/*.ts extra rule-specific helpers
src/utils/*.ts                     shared helpers (paths, fixtures, options, listeners)
openspec/specs/<rule>/spec.md      spec scenarios per rule
scripts/                           tooling scripts
dist/                              build output (generated)
```

## Lint Guardrails

Enforced via ESLint — `npm run verify` catches violations.

- Complexity: max **8** (max **1** in test files)
- Max params: **4**
- Max lines per function: **50**
- Max lines per file: **600**
- **`TSAsExpression` is banned** — including `as const`. Use type guards, explicit types, or `readonly` tuples instead (e.g. `const X: readonly ['a', 'b'] = ['a', 'b']`).
- Prefer extracting helpers over disabling lint rules.

## Code Style

### Imports

- ESM only. Use `import type` for type-only imports.
- `node:` protocol for Node built-ins.
- Relative paths with `.js` extension for internal imports.
- Group: Node built-ins, external deps, internal modules.

### Formatting

- Prettier config: 2 spaces, single quotes, no semicolons, trailing commas, print width 100.
- Follow existing formatting; avoid unrelated reformatting.
- Small functions, early returns, thin visitor callbacks.
- Comments only for non-obvious intent.

### Types

- Avoid `any`; prefer `unknown` + narrowing.
- Reuse upstream types before inventing local duplicates.
- Favor type guards, discriminated unions, typed maps/records.

### Naming

- Rule IDs / folders: `kebab-case`
- Variables / functions: `camelCase`
- Types / interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

## Rule Authoring

- Default-export a `Rule.RuleModule`.
- Include complete `meta`: `type`, `docs.description`, `docs.recommended`, `schema`, `messages`.
- Use `messageId` in reports and tests.
- Parse non-trivial options through helpers, not inline branching.
- Return `{}` early from `create(context)` when prerequisites are missing.
- Register new rules in `src/rules/index.ts`.

## Module Boundaries

- Each rule lives in `src/rules/<rule>/` with `index.ts` as the public API.
- Rule source may import from: same folder, `src/utils/`, Node built-ins, external packages. **Cross-rule imports are forbidden.**
- `src/utils/` must not import from `src/rules/`.
- Tests import the rule through its `index.ts` and treat it as a black box.
- Architecture boundaries are enforced at lint time via `settings.unslop.architecture`.

## Error Handling

- Never throw during lint execution; use graceful fallbacks.
- Treat missing parser services or TS program as non-fatal.
- Guard nullish values. Don't assume files exist.
- Return `undefined` for "not applicable" outcomes.

## TSConfig Resolution

- The plugin locates the nearest `tsconfig.json` per file using TS config discovery (with `extends` resolution).
- Provides project root, source root, compiler options, and a cached semantic project context.
- Module resolution (including `paths`/`baseUrl`) uses TypeScript's own resolver.
- Rules needing a semantic project become no-ops when no `tsconfig.json` is found.

## Path Handling

- Use `node:path` helpers for all path logic.
- Normalize comparisons using repo helpers like `normalizePath` and `isInsidePath`.
- Avoid platform-specific assumptions.

## Testing Conventions

**All tests are end-to-end via `RuleTester`.** No unit tests of internal helpers.

- Every test uses `scenario()` from `src/utils/test-fixtures/index.ts` — the only shared test utility.
- **Do not add exports to that file** without strong justification (needed by 3+ test files).
- Every test is self-contained: all inputs inline in the `scenario()` call.
- `scenario.todo('description')` marks unimplemented spec scenarios.
- Each named scenario in `openspec/specs/<rule>/spec.md` must have a matching `scenario()` call.
- Test descriptions are behavior statements, not labels.
- No `beforeEach`/`afterEach`/`afterAll` for fixtures — use `scenario({ files: [...] })`.

### `scenario()` API

| Case                     | Required fields                         |
| ------------------------ | --------------------------------------- |
| Valid                    | `code`                                  |
| Invalid with autofix     | `code`, `errors`, `output`              |
| Invalid without autofix  | `code`, `errors`, `output: null`        |
| Filesystem-scanning rule | `files`, `filename`                     |
| TypeScript syntax        | `typescript: true` (only for TS syntax) |
| Architecture rules       | `settings.unslop` inline                |

## Workflow

1. Read the target rule, its helpers, and colocated tests before editing.
2. Keep edits minimal — no drive-by refactors.
3. Run the most targeted test first.
4. Run `npm run fix` if lint/format issues appear.
5. Run `npm run verify` — must exit clean.
6. Run `npm run test` — all tests must pass.

## Release Process

- Manual `workflow_dispatch` in GitHub Actions with a `bump` input (patch/minor/major).
- Bumps version, commits to main, tags, runs verify + test, then publishes with OIDC provenance.
- `github-actions[bot]` has branch protection bypass for the version commit.
