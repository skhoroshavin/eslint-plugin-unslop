## Why

Rule test scenarios that require virtual files currently duplicate linted source in two places: the `files` fixture content and top-level `code`. This duplication makes tests harder to read, increases maintenance cost during refactors, and creates drift risk when only one copy is updated.

## What Changes

- Introduce a simplified `scenario()` input model with two explicit shapes: simple scenarios (`code`) and full scenarios (`files` + `filename`).
- Keep RuleTester as the execution engine, but convert full scenarios to RuleTester cases internally.
- Enforce strict full-scenario validation: the lint target (`filename`) must exist in `files` and must provide explicit `content`.
- Migrate existing rule tests to the new full-scenario shape by removing duplicated top-level `code` from file-backed scenarios.
- Preserve existing test capabilities (`settings`, `typescript`, `output`, expected errors) in both shapes where applicable.

## Capabilities

### New Capabilities

- `rule-test-scenarios`: Defines a strict, non-ambiguous scenario DSL for rule tests with separate simple and full modes and deterministic conversion to RuleTester.

### Modified Capabilities

- None.

## Impact

- Affected code: `src/utils/test-fixtures/index.ts` and file-backed rule tests under `src/rules/*/*.test.ts`.
- Affected tests: `import-control`, `export-control`, `no-whitebox-testing`, `no-false-sharing`, and `no-single-use-constants` scenario definitions.
- API/behavior: internal test-fixture API becomes stricter for full scenarios; runtime rule behavior is unchanged.
- Risk: migration may temporarily break tests if any full scenario omits target file content; strict validation surfaces this early.

## Non-goals

- No changes to rule semantics, messages, or autofix behavior.
- No migration of simple in-memory scenarios to file-backed scenarios.
- No changes to plugin runtime APIs or published rule options.
