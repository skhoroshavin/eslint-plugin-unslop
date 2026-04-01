# AGENTS.md

Guidance for coding agents working in `eslint-plugin-unslop`.

## Purpose

- This repository publishes an ESLint plugin focused on detecting low-quality or AI-slop patterns.
- The codebase is small, TypeScript-first, ESM-only, and optimized for strict linting and predictable rule behavior.
- Most changes involve ESLint rule logic, shared utilities, or rule tests.

## Project Snapshot

- Package manager: `npm`
- Runtime target: Node.js `>=18`
- Language: TypeScript with `strict: true`
- Module system: ESM (`"type": "module"`)
- Tooling: `tsup`, ESLint v9 flat config, `typescript-eslint`, Vitest, Prettier

## Setup And Commands

- Install deps: `npm install`
- Build: `npm run build`
- Fix (autofix knip, lint, formatting): `npm run fix`
- Verify (format check, knip, typecheck, build, lint): `npm run verify`
- Test all: `npm run test`
- Test watch: `npm run test:watch`
- Prepublish (runs before publish): `npm run prepublishOnly`

## Command Notes

- `npm run test` maps to `vitest run`; `npm run test:watch` maps to `vitest`
- `prepublishOnly` runs `npm run build`
- There is no `vitest.config.ts` in the current repo; Vitest is using defaults

## Running A Single Test

- Single test file: `npm run test -- src/rules/no-deep-imports.test.ts`
- Another file example: `npm run test -- src/rules/no-special-unicode.test.ts`
- Single test by name: `npm run test -- -t "two levels deep within same folder is blocked"`
- Single file + test name: `npx vitest run src/rules/no-deep-imports.test.ts -t "two levels deep within same folder is blocked"`
- Watch one file: `npx vitest src/rules/no-deep-imports.test.ts`

## Repository Layout

- `src/index.ts`: plugin entrypoint and generated shareable configs
- `src/rules/index.ts`: exported rule map
- `src/rules/*.ts`: rule modules and colocated rule tests
- `src/rules/<rule-name>/*.ts`: rule-specific helpers for larger rules
- `src/utils/*.ts`: shared helpers used across rules and tests
- `dist/`: build output from `tsup`
- `eslint.config.mjs`, `tsconfig.json`, `tsup.config.ts`: repo tooling config

## Important Current Structure Notes

- Tests live beside rules in `src/rules/*.test.ts`, not in a top-level `tests/` directory
- `src/utils/test-fixtures.ts` provides the shared `RuleTester` and temp project helpers
- `CLAUDE.md` only points back to `AGENTS.md`

## Local Lint Guardrails

- Cyclomatic complexity max is `8`
- Max function parameters is `4` (use objects/structures when more are needed)
- Max lines per function is `50`
- Max lines per file is `600`
- `TSAsExpression` is forbidden, so `value as Type` is not allowed
- Prefer extracting helpers over disabling lint rules

## Code Style: Imports

- Use ESM imports/exports only
- Use `import type` for type-only imports
- Use the `node:` protocol for Node built-ins
- Keep internal imports relative and include the `.js` extension
- Common grouping is: Node built-ins, external packages, then internal relative modules

## Code Style: File Order

- Follow the existing dependency-direction ordering used in this repo
- After imports, place exported or top-level symbols before helpers they depend on
- Keep related constants near the rule or helper they support when that matches local style

## Code Style: Formatting

- Follow existing formatting and avoid unrelated reformatting
- Prettier settings are 2 spaces, single quotes, no semicolons, trailing commas in multiline literals, and `printWidth` 100
- Prefer small focused functions, early returns, and thin visitor callbacks
- Add comments only when the logic is not obvious from the code itself

## Code Style: Types

- Preserve `strict` TypeScript compatibility
- Avoid `any`; prefer `unknown` plus narrowing when input shape is uncertain
- Avoid type assertions with `as` (but `as const` is fine)
- Use explicit interfaces or types for structured data and options
- Use type guards, narrow unions, and typed maps or records where they improve clarity
- Before defining a custom type or interface, check whether an imported library already exports a suitable type; prefer reusing library types over duplicating their shape locally

## Naming Conventions

- Rule files use kebab-case, for example `no-deep-imports.ts`
- Rule IDs match filenames in kebab-case
- Variables and functions use camelCase
- Interfaces and types use PascalCase
- Constants with fixed symbolic meaning use UPPER_SNAKE_CASE
- Test names should read like behavior statements

## Rule Authoring Conventions

- Export rule modules as default exports satisfying `Rule.RuleModule`
- Include `meta.type`, `meta.docs.description`, `meta.docs.recommended`, and `meta.schema`
- Prefer `messages` plus `messageId` over hard-coded diagnostic strings in tests
- Parse non-trivial options in small helpers
- In `create(context)`, return `{}` early when prerequisites are missing
- If a new rule is added, also register it in `src/rules/index.ts`
- If the rule should join the recommended config, set `meta.docs.recommended` to `true`

## Error Handling And Resilience

- Prefer graceful fallbacks over throwing during rule execution
- Treat missing parser services or missing TypeScript program state as non-fatal
- Guard nullable and optional values before dereferencing
- Return `undefined` from helpers for "not applicable" cases when that fits local style
  - But if function normally returns string, and empty string can be treated as `undefined`,
    return empty string instead of making signature more complex with potential undefined
- Avoid assuming a file exists without checking first

## Filesystem And Path Practices

- Use `node:path` helpers such as `join`, `resolve`, `dirname`, and `relative`
- Normalize path comparisons when needed; this repo already uses helpers like `toPosix` and `isInsidePath`
- Avoid platform-specific path assumptions
- Be careful around `sourceRoot` handling because rules support both inferred and explicit roots

## Testing Conventions

- Use Vitest imports explicitly; globals are not enabled
- Use ESLint `RuleTester` for rule tests
- Keep `valid` and `invalid` cases explicit in `ruleTester.run(...)`
- Prefer checking `messageId` instead of full message text when possible
- For path-sensitive behavior, use temporary project fixtures instead of real repo files
- Clean up temp fixtures in `afterAll` when a test file creates them

## Change Workflow For Agents

- Read the rule, nearby helpers, and its test file before changing behavior
- Keep edits scoped and avoid opportunistic refactors
- Preserve current import style, path conventions, and `.js` extension usage
- Run the most targeted test command first, then broader validation if needed
- Use `npm run fix` to autofix issues, then `npm run verify` to confirm, then `npm run test`
