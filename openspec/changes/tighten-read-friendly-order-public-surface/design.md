## Context

`unslop/read-friendly-order` currently detects declaration-order inversions mainly through local dependency checks and emits canonical autofix output, but the top-level output does not consistently keep public API surface as high as possible. In particular, local public exports can remain intermixed with private declarations, and re-export handling is too coarse (external re-exports and local export lists are treated together).

The proposal also broadens export-surface policy: `export * from ...` should be rejected universally, not only in entrypoints.

## Goals / Non-Goals

**Goals:**

- Enforce explicit top-level bands for readability: imports, external re-exports, local public API, then private declarations.
- Preserve consumer-first dependency ordering within each band.
- Prioritize local `export default` at the top of the local public API band when fix-safe and runtime-safe.
- Keep autofix deterministic and idempotent.
- Extend export-control behavior so wildcard re-exports are always denied.

**Non-Goals:**

- Adding new rule options or user-tunable ordering policies.
- Expanding class-member ordering semantics beyond existing behavior.
- Refactoring unrelated architecture resolution utilities.
- Introducing non-deterministic heuristics for statement movement.

## Decisions

### 1) Introduce explicit top-level statement banding in read-friendly-order

- Decision: classify top-level statements into four bands: (1) imports, (2) external re-exports (`export ... from ...`, including wildcard), (3) local public API (`export` declarations, local export lists, and local `export default`), (4) private declarations/helpers/constants/types.
- Rationale: this directly enforces public-surface-first reading order and removes accidental intermixing between API and implementation details.
- Alternative considered: keep single global dependency ordering and only add extra diagnostics. Rejected because it does not guarantee public symbols remain high in final fixed output.

### 2) Preserve consumer-first ordering semantics inside each band

- Decision: within a band, retain existing consumer-first semantics (consumer above consumed symbol) based on current local dependency analysis.
- Rationale: this keeps the rule's core top-down readability model and aligns with existing expected behavior.
- Alternative considered: dependency-source-first ordering (symbols with no local dependencies first). Rejected because it inverts the current entrypoint-first reading model.

### 3) Prioritize local export default at the top of local public API band

- Decision: when a local `export default` is present, place it as high as possible inside band 3, unless eager-initialization safety constraints prevent movement.
- Rationale: default export commonly represents the primary entrypoint and should be surfaced first when safe.
- Alternative considered: keep default exports in ordinary dependency order only. Rejected because it weakens API-first scanability and the user intent for explicit default priority.

### 4) Split external re-exports from local export lists

- Decision: external re-exports belong in band 2 (immediately after imports), while local export lists belong in band 3 with other local public API.
- Rationale: external re-exports act as boundary wiring, while local export lists are part of local API surface declaration.
- Alternative considered: keep all re-export-like forms in one bucket. Rejected because it collapses two different readability roles and caused undesired ordering.

### 5) Expand export-control prohibition for wildcard re-exports

- Decision: `unslop/export-control` reports `exportAllForbidden` for wildcard re-exports in all files, not only entrypoints.
- Rationale: explicit symbol surfaces are preferred everywhere; universal prohibition avoids policy drift and ambiguity.
- Alternative considered: keep entrypoint-only prohibition. Rejected because wildcard export surfaces remain available elsewhere and undermine consistency.

## Risks / Trade-offs

- [Risk] Re-banding top-level nodes could create unexpected reorder output in edge cases with mixed export forms. → Mitigation: add explicit RuleTester scenarios for each export form and for mixed-band files.
- [Risk] More files may receive new diagnostics/fixes after tightening. → Mitigation: preserve safety guards (comments/trivia ambiguity, eager runtime exclusions) and keep output deterministic.
- [Trade-off] Additional classification logic increases rule complexity. → Mitigation: isolate band-classification helpers and keep visitor path short.
- [Risk] Universal wildcard export ban may affect projects using barrel patterns outside entrypoints. → Mitigation: clear diagnostic messaging and targeted spec/test coverage.

## Migration Plan

1. Update OpenSpec deltas for `read-friendly-order-autofix` and `architecture-import-export-control` with banding and wildcard-ban behavior.
2. Implement `read-friendly-order` top-level band classification and canonical reorder strategy updates.
3. Implement `export-control` wildcard export-all prohibition in non-entrypoint files.
4. Add/adjust RuleTester scenarios for mixed export forms and wildcard rejection scope.
5. Run targeted tests first, then `npm run fix`, `npm run verify`, and `npm run test`.
6. Rollback strategy: revert rule and test deltas together if significant false positives appear.

## Open Questions

- None.
