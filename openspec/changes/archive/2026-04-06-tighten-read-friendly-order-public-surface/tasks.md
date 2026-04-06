## 1. Rule Analysis and Ordering Model

- [x] 1.1 Review current `read-friendly-order` top-level classification and fix builder flow in `src/rules/read-friendly-order/index.ts` and `src/rules/read-friendly-order/ast-utils.ts`.
- [x] 1.2 Define explicit node-to-band mapping for imports, external re-exports, local public API, and private declarations.
- [x] 1.3 Validate how eager-initialization and comment-safety checks interact with the new banding model.

## 2. read-friendly-order Implementation

- [x] 2.1 Update top-level ordering logic to enforce canonical band order: imports -> external re-exports -> local public API -> private declarations.
- [x] 2.2 Keep consumer-first dependency ordering within each band.
- [x] 2.3 Add local `export default` priority at the top of the local public API band when movement is safe.
- [x] 2.4 Split external re-export detection from local export-list classification so they no longer share a single bucket.

## 3. export-control Implementation

- [x] 3.1 Update `src/rules/export-control/index.ts` so wildcard `export * from ...` is rejected in all files.
- [x] 3.2 Preserve existing symbol-contract behavior for named and default exports.

## 4. RuleTester Coverage

- [x] 4.1 Add `read-friendly-order` scenarios for mixed top-level bands and deterministic canonical output.
- [x] 4.2 Add scenarios proving external re-exports remain above local public exports.
- [x] 4.3 Add scenarios proving local export lists are grouped with local public API (not external re-exports).
- [x] 4.4 Add scenarios proving local `export default` is prioritized within the local public band when safe.
- [x] 4.5 Add `export-control` scenario(s) where non-entrypoint `export * from ...` is rejected.

## 5. Verification

- [x] 5.1 Run targeted tests for `read-friendly-order` and `export-control` and resolve failures.
- [x] 5.2 Run `npm run fix`, then `npm run verify`, then `npm run test`.
