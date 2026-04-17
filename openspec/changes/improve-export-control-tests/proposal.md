## Why

`unslop/export-control` currently enforces several export forms that are only partially represented in its spec and end-to-end tests. Tightening that coverage now reduces the risk of silent regressions in a rule that defines module public-surface contracts.

## What Changes

- Expand `export-control` scenario coverage to exercise the rule's existing entrypoint-only contract behavior across more export shapes.
- Document and test source-bearing named exports and other constrained-entrypoint cases that the current implementation already handles but the spec does not spell out clearly.
- Keep the change focused on spec clarity and RuleTester coverage rather than broad rule refactors or new architecture semantics.

## Non-goals

- Changing `export-control` policy syntax or adding new configuration fields.
- Broadening `export-control` beyond its current responsibility for export-all rejection and entrypoint symbol contracts.
- Modifying `import-control`, shared architecture parsing, or unrelated rule behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `export-control`: clarify and extend the documented `export-control` requirements so the spec and end-to-end tests cover the export forms and entrypoint cases the rule is expected to enforce.

## Impact

- `openspec/specs/export-control/spec.md`
- `src/rules/export-control/index.test.ts`
- Potentially `src/rules/export-control/index.ts` if the clarified scenarios expose gaps between intended and actual behavior
