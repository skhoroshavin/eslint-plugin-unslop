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

- Single file: `npm run test -- src/rules/no-deep-imports/index.test.ts`
- Another file example: `npm run test -- src/rules/no-special-unicode/index.test.ts`
- Autofix-specific file: `npm run test -- src/rules/read-friendly-order/autofix.test.ts`
- Single test name across suite: `npm run test -- -t "two levels deep within same folder is blocked"`
- Single file + test name: `npx vitest run src/rules/no-deep-imports/index.test.ts -t "two levels deep within same folder is blocked"`
- Watch one file: `npx vitest src/rules/no-deep-imports/index.test.ts`

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

- Rule file and rule id naming: kebab-case (for example, `no-deep-imports`).
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

## Error Handling And Resilience

- Favor graceful fallbacks over throwing during lint execution.
- Treat missing parser services or TS program state as non-fatal.
- Guard nullish values before dereferencing.
- Do not assume files exist; check first.
- For "not applicable" helper outcomes, return `undefined` or another established local sentinel consistently.

## Filesystem And Path Practices

- Use `node:path` helpers (`join`, `resolve`, `dirname`, `relative`) for path logic.
- Normalize path comparisons when needed (for example using repo helpers like `toPosix` and `isInsidePath`).
- Avoid platform-specific assumptions.
- Be careful with `sourceRoot` handling; rules support inferred and explicit roots.

## Testing Conventions

- Import Vitest APIs explicitly; globals are not enabled.
- Use shared test utilities from `src/utils/test-fixtures.ts`.
- Keep `valid` and `invalid` cases explicit in `ruleTester.run(...)`.
- Prefer `messageId` assertions over full text checks when possible.
- For path-sensitive behavior, use temporary fixtures, not real repo files.
- Ensure temp fixture cleanup in `afterAll` where applicable.

## Recommended Change Workflow For Agents

- Read the target rule, nearby helpers, and its colocated tests before editing.
- Keep edits minimal and avoid drive-by refactors.
- Run the most targeted test command first.
- Then run broader checks as needed (`npm run verify`, then `npm run test`).
- Use `npm run fix` to apply autofixes before final verification when lint/format issues appear.
