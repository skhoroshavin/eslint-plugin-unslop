## Why

The rules codebase has started to develop rule-specific helpers and structural conventions, but those boundaries are still implicit. Formalizing a per-rule folder layout and import guardrails now keeps the plugin easy to evolve, prevents accidental coupling between rules, and makes each rule easier to reason about as an independent black-box ESLint module.

## What Changes

- Reorganize each ESLint rule into its own folder under `src/rules/<rule>/` with a single public `index.ts` entrypoint.
- Restrict `src/rules/index.ts` to importing only `src/rules/<rule>/index.ts` files.
- Prevent rules from importing code from other rules, while still allowing shared dependencies from `src/utils` and external packages.
- Treat rule tests as black-box consumers by allowing them to import only their rule's `index.ts` plus approved shared test utilities.
- Add a minimal dependency-cruiser configuration that enforces these architectural boundaries with an allowlist-style policy, including `src/utils` boundaries (no utils -> rules imports).
- Update `unslop/no-false-sharing` configuration to use directory mode so the repository's own linting matches the new folder-based cohesion model.

## Non-goals

- Changing rule behavior, diagnostics, or autofix semantics.
- Introducing nested subfolder conventions inside individual rule folders.
- Standardizing private helper filenames beyond the new public-entrypoint rule.
- Expanding dependency-cruiser coverage beyond the rule architecture boundaries and closely related utility boundaries described here.

## Capabilities

### New Capabilities

- `rule-module-boundaries`: Define and enforce the allowed folder layout and import boundaries for rule implementation files, rule entrypoints, and rule tests.

### Modified Capabilities

None.

## Impact

- Affected code: `src/rules/index.ts`, every rule file/test migrated into per-rule folders, and lint/tooling configuration.
- New dependency: dependency-cruiser for architecture validation.
- Developer workflow: rule authors get a clearer public/private boundary for rule code and tests.
- Repository linting: `unslop/no-false-sharing` will evaluate shared areas in directory mode instead of file mode.
