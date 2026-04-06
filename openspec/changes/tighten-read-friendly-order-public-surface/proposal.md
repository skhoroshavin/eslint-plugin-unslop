## Why

`unslop/read-friendly-order` currently focuses on local dependency inversions, but it does not strongly enforce a public-surface-first file shape. In practice this still allows too much intermixing between public API symbols and private helpers, which weakens the rule's readability goal.

The current autofix also groups all re-exports at the end of a file, which conflicts with a reader-first scan pattern. External re-exports are part of API surface signaling and should be near imports, while local export lists belong with local public API declarations.

Additionally, `export * from ...` remains allowed outside entrypoint-specific checks in `unslop/export-control`. This creates policy drift: teams can still use wildcard export surfaces in places where explicit symbol surfaces are preferred.

## What Changes

- Tighten `unslop/read-friendly-order` top-level ordering to enforce explicit bands:
  - imports
  - external re-exports (`export ... from ...`)
  - local public API (`export` declarations, local export lists, and local `export default`)
  - private helpers/constants/types
- Keep consumer-first ordering semantics within each band (entrypoints before the helpers they consume).
- Prioritize local `export default` at the top of the local public API band when movement is safe and not blocked by eager initialization constraints.
- Split external re-exports from local export lists (today they are grouped too coarsely).
- Strengthen export policy so `export * from ...` is disallowed universally, not only on module entrypoints.
- Add explicit scenarios for mixed export forms so ordering behavior remains deterministic and idempotent.

## Non-goals

- Introducing new user configuration options for ordering bands.
- Changing class-member ordering semantics beyond existing `read-friendly-order` class behavior.
- Refactoring unrelated rule internals or helper APIs.
- Changing architecture module matching or source-root resolution behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `read-friendly-order-autofix`: Strengthen top-level canonical ordering to enforce public-surface-first banding with separate treatment for external re-exports and local public API, while preserving consumer-first ordering within each band.
- `architecture-import-export-control`: Expand export-all prohibition so `unslop/export-control` rejects `export * from ...` universally.

## Impact

- Affected specs:
  - `openspec/specs/read-friendly-order-autofix/spec.md`
  - `openspec/specs/architecture-import-export-control/spec.md`
- Affected implementation:
  - `src/rules/read-friendly-order/index.ts`
  - `src/rules/read-friendly-order/ast-utils.ts`
  - `src/rules/export-control/index.ts`
- Affected tests:
  - `src/rules/read-friendly-order/index.test.ts`
  - `src/rules/export-control/index.test.ts`
- Potential behavior change:
  - More files may be flagged/reordered when public symbols are below private ones or when wildcard re-exports are used.
