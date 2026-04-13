# AGENTS.md

Guidance for coding agents working in `eslint-plugin-unslop`.

## Purpose

- This repository publishes an ESLint plugin that flags low-quality, often LLM-generated code patterns.
- Most work is in ESLint rule logic, rule helper utilities, and Vitest-based rule tests.
- Keep behavior deterministic, narrow in scope, and easy to reason about.

## Project Snapshot

- Package manager: `npm`
- Runtime: Node.js `>=18`
- Language: TypeScript (`strict: true`)
- Module system: ESM (`"type": "module"`)
- Build tool: `tsup`
- Linting: ESLint v9 flat config + `typescript-eslint`
- Formatting: Prettier
- Tests: Vitest + ESLint `RuleTester`

## Setup And Core Commands

- Install dependencies: `npm install`
- Build distributable: `npm run build`
- Run full test suite once: `npm run test`
- Run tests in watch mode: `npm run test:watch`
- Apply autofixes: `npm run fix`
- Full verification pipeline: `npm run verify`
- Prepublish hook: `npm run prepublishOnly`

## What Each Script Runs

- `npm run build` -> `tsup`
- `npm run test` -> `vitest run`
- `npm run test:watch` -> `vitest`
- `npm run fix` -> `knip --fix && eslint . --fix && prettier . --write`
- `npm run verify` -> `prettier . --check && knip && depcruise src && jscpd && tsc --noEmit && tsup && eslint .`

## Running A Single Test (Important)

- Single file: `npm run test -- src/rules/no-special-unicode/index.test.ts`
- Another file example: `npm run test -- src/rules/import-control/index.test.ts`
- Single test name across suite: `npm run test -- -t "cross-module import is blocked"`
- Single file + test name: `npx vitest run src/rules/import-control/index.test.ts -t "cross-module import is blocked"`
- Watch one file: `npx vitest src/rules/import-control/index.test.ts`

## Repository Layout

- `src/index.ts`: plugin entrypoint and generated shareable configs
- `src/rules/index.ts`: exported rule registry
- `src/rules/<rule-name>/index.ts`: main implementation for each rule
- `src/rules/<rule-name>/*.test.ts`: colocated tests for each rule
- `src/rules/read-friendly-order/*.ts`: extra helpers and rule-specific modules
- `src/utils/*.ts`: shared helpers for paths, fixtures, option parsing, and listeners
- `dist/`: build output (generated)
- `eslint.config.mjs`, `tsconfig.json`, `tsup.config.ts`: core tooling configuration

## Agent Instruction Files

- Primary agent guide is this file: `AGENTS.md`.
- `CLAUDE.md` points back to `AGENTS.md`.
- No repository Cursor rules were found in `.cursor/rules/`.
- No `.cursorrules` file was found.
- No GitHub Copilot instructions file was found at `.github/copilot-instructions.md`.
- If any of those files are added later, treat them as high-priority constraints.

## Local Lint Guardrails

- Cyclomatic complexity max: `8`
- Max params per function: `4`
- Max lines per function: `50`
- Max lines per file: `600`
- `TSAsExpression` is forbidden; avoid `value as Type` assertions
- In tests (`src/**/*.test.ts`), `complexity` is constrained very aggressively (`max: 1`)
- Prefer extracting helpers over disabling lint rules

## Code Style: Imports

- Use ESM imports/exports only.
- Use `import type` for type-only imports.
- Use `node:` protocol for Node built-ins.
- Keep internal imports relative and include `.js` extension.
- Typical grouping: Node built-ins, external deps, internal modules.

## Code Style: Formatting And Structure

- Follow existing formatting; avoid unrelated reformatting.
- Prettier defaults in this repo: 2 spaces, single quotes, no semicolons, trailing commas where valid, print width ~100.
- Prefer small functions, early returns, and narrow helper boundaries.
- Keep visitor callbacks thin; move heavier logic to helpers.
- Add comments only for non-obvious intent or tricky invariants.

## Code Style: Types

- Maintain strict TypeScript compatibility.
- Avoid `any`; prefer `unknown` plus narrowing.
- Avoid type assertions with `as` (except `as const` where appropriate).
- Reuse upstream/library-exported types before inventing local duplicates.
- Use explicit interfaces/types for structured option objects and parsed state.
- Favor type guards, discriminated unions, and typed maps/records.

## Naming Conventions

- Rule file and rule id naming: kebab-case (for example, `import-control`).
- Variables/functions: camelCase.
- Types/interfaces: PascalCase.
- Symbolic constants: UPPER_SNAKE_CASE.
- Test names should read like behavior statements.

## Rule Authoring Conventions

- Export rule modules as default exports satisfying `Rule.RuleModule`.
- Include complete `meta`: `type`, `docs.description`, `docs.recommended`, `schema`, and `messages`.
- Prefer `messageId` usage in reports/tests over matching full literal strings.
- Parse non-trivial options through helpers instead of inline branching.
- In `create(context)`, return `{}` early when prerequisites are absent.
- Register new rules in `src/rules/index.ts` and wire into configs when intended.

## Module Boundaries

- Each rule lives in `src/rules/<rule>/` with a public `index.ts` entrypoint.
- Non-test files in a rule folder MUST only import from the same folder, `src/utils/`, Node built-ins, or external packages. Cross-rule imports are forbidden.
- Tests MUST import the rule through its public `index.ts` and treat it as a black box.
- `src/utils/` MUST NOT import from `src/rules/`.
- Architecture boundaries are enforced at lint time via `settings.unslop.architecture` using allowlist-style `imports`/`exports` policies. `npm run verify` covers this through ESLint.
- Shared modules (e.g., `utils`) are declared with `shared: true` in settings; `unslop/no-false-sharing` is enabled without rule-level options.

## Error Handling And Resilience

- Favor graceful fallbacks over throwing during lint execution.
- Treat missing parser services or TS program state as non-fatal.
- Guard nullish values before dereferencing.
- Do not assume files exist; check first.
- For "not applicable" helper outcomes, return `undefined` or another established local sentinel consistently.

## TSConfig Resolution

- The plugin locates the nearest `tsconfig.json` per linted file using TypeScript config discovery APIs, including full `extends` resolution.
- The resolved config provides project root, source root, compiler options, and a shared semantic project context for cross-file analysis.
- `compilerOptions.paths` and `baseUrl` participate through TypeScript's own module resolver — no separate paths-matcher implementation.
- A specifier is local when TypeScript resolves it to a file inside the project; otherwise it is external.
- The plugin caches one semantic project context per unique `tsconfig.json` path per lint run.
- Rules that need a semantic project become no-ops when no `tsconfig.json` is found or the file is outside the project.

## Filesystem And Path Practices

- Use `node:path` helpers (`join`, `resolve`, `dirname`, `relative`) for path logic.
- Normalize path comparisons when needed (for example using repo helpers like `toPosix` and `isInsidePath`).
- Avoid platform-specific assumptions.
- Be careful with `sourceRoot` handling; rules support inferred and explicit roots.

## Testing Conventions

This section is the single authoritative reference for test conventions.

- All tests are end-to-end through `RuleTester`. No unit tests of internal helpers. Internal helper behavior must be covered through rule-level e2e scenarios.
- Every test case uses `scenario()` from `src/utils/test-fixtures/index.ts` — the one and only shared test utility.
- **Do not add exports to `src/utils/test-fixtures/index.ts`.** A second export requires justification that it is needed by 3+ test files and cannot be composed from `scenario()`.
- Every test case is self-contained: all inputs (code, settings, file layout) are written inline in the `scenario()` call, no scrolling required. Keep values inline unless shared by 3+ scenarios in the same file.
- `scenario.todo('description')` marks a spec scenario not yet covered by an implementation.
- `messageId` assertions are preferred over raw `message` strings (use rendered `message` only for inherently dynamic text).
- Each named scenario in `openspec/specs/<rule>/spec.md` must have a corresponding `scenario()` call with a description that mirrors the spec scenario name.
- Test descriptions must read as behavior statements (e.g., `cross-module import not declared in allowlist is reported`), not labels like `test 1`.
- Do not hide setup or assertions behind lifecycle-managed fixtures or custom assertion wrappers. Use `scenario({ files: [...] })` for filesystem layout; avoid `beforeEach`/`afterEach`/`afterAll` for temp fixtures.
- `scenario(description, rule, options)` accepts: `files`, `typescript`, `settings`, `code`, `filename`, `errors`, `output`.
  - Valid case: only `code` needed.
  - Invalid with autofix: `errors` + full expected `output`.
  - Invalid without autofix: `errors` + `output: null`.
  - Filesystem-scanning rule: `files` + `filename` (resolved relative to temp dir).
  - TypeScript syntax: set `typescript: true` (only when code uses TS syntax, not just because the rule is written in TS).
  - Architecture rules: provide `settings.unslop` inline.

## Release Process

- Releases are triggered manually via `workflow_dispatch` in GitHub Actions with a `bump` input (`patch`, `minor`, or `major`).
- The workflow bumps `package.json` and `package-lock.json`, commits to `main`, creates an annotated tag (e.g., `v0.3.0`), then runs `npm run verify` and `npm run test` before publishing.
- If verify or tests fail, the publish is aborted.
- Publishing uses OIDC-based npm authentication with signed provenance. A GitHub release with auto-generated notes is created after successful publish.
- Branch protection grants bypass to `github-actions[bot]` for the version bump commit; human direct pushes to `main` are rejected.

## Recommended Change Workflow For Agents

- Read the target rule, nearby helpers, and its colocated tests before editing.
- Keep edits minimal and avoid drive-by refactors.
- Run the most targeted test command first.
- Then run broader checks as needed (`npm run verify`, then `npm run test`).
- Use `npm run fix` to apply autofixes before final verification when lint/format issues appear.

## Pre-Push Checklist (Mandatory)

Before pushing any branch or creating a PR, **always** run these in order:

1. `npm run fix` — auto-fixes lint, format, and unused import issues; address anything it cannot auto-fix
2. `npm run verify` — full pipeline (prettier, knip, jscpd, tsc, tsup, eslint); must exit clean
3. `npm run test` — all tests must pass

Common pitfalls to watch for:

- `knip` flags binaries referenced in workflow files (e.g. `tsx`) if they are not in `devDependencies` — add them
- The `no-restricted-syntax` ESLint rule bans **all** `TSAsExpression`, including `as const`; use explicit tuple/readonly types instead (e.g. `const X: readonly ['a', 'b'] = ['a', 'b']`)
- New files in `scripts/` are linted and knip-checked; they must satisfy all the same rules as `src/`
