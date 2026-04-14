## Context

`scenario()` in `src/utils/test-fixtures/index.ts` currently accepts one broad shape and requires top-level `code` even for filesystem-backed scenarios. Many tests also provide equivalent source in `files[].content`, causing duplication and occasional drift risk. The migration touches shared fixture infrastructure and multiple rule test suites, so we need a clear contract before implementation.

## Goals / Non-Goals

**Goals:**

- Define two readable scenario shapes without adding discriminator fields.
- Keep RuleTester as the underlying executor and convert scenario inputs directly to RuleTester test cases.
- Make full scenarios strict so lint target source is always derived from `files` and never duplicated.
- Preserve existing scenario capabilities (`errors`, `output`, `settings`, `typescript`) used across current tests.
- Migrate all existing full scenarios to the strict shape.

**Non-Goals:**

- Change runtime rule behavior, diagnostics, or autofixes.
- Introduce new test utilities beyond `scenario()`.
- Redesign in-memory simple scenarios that already use only `code`.

## Decisions

### Decision: Use a structural union with `SimpleScenario` and `FullScenario`

- `SimpleScenario` keeps `code` as the source of truth.
- `FullScenario` requires `files` + `filename` and forbids top-level `code` at type level.
- No `kind` field is added; mode is inferred via presence of `files`.

Alternatives considered:

- Add `kind: 'simple' | 'full'`: clearer at runtime, but noisier in every callsite.
- Keep a single permissive shape: lowest churn, but preserves ambiguity and duplication risk.

### Decision: Reuse RuleTester error types

- Scenario error typing reuses RuleTester-native test case error types instead of custom local duplicates.

Alternative considered:

- Keep local `ScenarioError` interface: simpler local control, but duplicates upstream contracts and can diverge.

### Decision: Full mode is strict and source-derived

- For full scenarios, linted source is resolved by matching `filename` to a `files` entry.
- The matching file must exist and must include explicit `content`.
- Missing/malformed full fixtures fail fast with clear setup errors.

Alternatives considered:

- Fallback to empty string or infer from top-level `code`: convenient, but hides fixture mistakes and reintroduces drift.

### Decision: Convert directly to RuleTester cases without intermediate models

- Keep existing `makeTester`/`makeFsTester` flow.
- Branch early for simple vs full, produce the final RuleTester case payload directly.

Alternative considered:

- Normalize through an internal `NormalizedScenario`: useful abstraction, but unnecessary indirection for this migration.

## Risks / Trade-offs

- [Migration churn in full suites] -> Apply mechanical edits file-by-file and run targeted suites after each batch.
- [Strict checks expose previously hidden fixture gaps] -> Treat failures as intended hardening; improve error messages for rapid fixes.
- [Type union edge cases for legacy hybrid objects] -> Use `never` guard fields in types to reject mixed shapes at compile time.

## Migration Plan

1. Update `scenario()` option types to the new `SimpleScenario | FullScenario` union.
2. Implement strict full-scenario extraction (`filename` match + required `content`) and direct RuleTester conversion.
3. Migrate full scenarios in `no-single-use-constants` and `no-false-sharing` (already content-complete) by removing top-level `code`.
4. Migrate full scenarios in `export-control`, `import-control`, and `no-whitebox-testing` by adding target `files` content and removing top-level `code`.
5. Run targeted rule tests, then full `npm run test` and `npm run verify`.

Rollback strategy:

- Revert the fixture helper and migrated tests together in one commit if migration uncovers unexpected instability.

## Open Questions

- None; requirements and migration scope are concrete.
