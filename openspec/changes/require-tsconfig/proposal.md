## Why

Several architecture and semantic rules currently fail open when `tsconfig.json` cannot be discovered or loaded, which can silently hide real violations and let CI pass with incomplete enforcement. We should make missing or invalid TypeScript project context an explicit lint failure so teams can trust rule outcomes.

## What Changes

- **BREAKING**: Rules that require TypeScript project context will report an explicit configuration error instead of becoming no-ops when `tsconfig.json` is missing, unresolved, or invalid for the linted file.
- Define consistent failure behavior and error messaging across architecture/semantic rules that currently rely on shared project context helpers.
- Update rule and config expectations so `configs.full` users get a visible failure when required architecture context is unavailable.
- Update tests/spec scenarios that currently assert graceful no-op behavior for missing semantic context.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `import-control`: Change behavior from semantic-project no-op to explicit failure when required project context is unavailable.
- `no-false-sharing`: Change behavior from semantic-project no-op to explicit failure when required project context is unavailable.
- `no-single-use-constants`: Change behavior from semantic-project no-op to explicit failure when required project context is unavailable.
- `no-whitebox-testing`: Change behavior from semantic-project no-op to explicit failure when required project context is unavailable.
- `plugin-configs`: Update full-config expectation to surface explicit failures for missing required TypeScript architecture context.

## Impact

- Affected code: shared TypeScript project/context resolution utilities and rules that branch on unavailable semantic project state.
- Affected tests/specs: scenario expectations that currently treat missing/invalid tsconfig as no-op must be updated.
- API/behavior: lint output changes from silent pass to explicit error reports for misconfigured TypeScript project context.
- Adoption risk: projects using `configs.full` without valid `tsconfig.json` near linted files will begin failing lint checks until configuration is fixed.

## Non-goals

- Changing rule detection logic unrelated to TypeScript project availability.
- Introducing new architecture policy syntax or modifying module boundary semantics.
- Reworking plugin config surface area beyond the behavior change needed to enforce required tsconfig context.
