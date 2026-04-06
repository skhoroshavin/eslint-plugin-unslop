## 1. Rule Analysis and Ordering Model

- [ ] 1.1 Review current `read-friendly-order` top-level classification and fix builder flow in `src/rules/read-friendly-order/index.ts` and `src/rules/read-friendly-order/ast-utils.ts`.
- [ ] 1.2 Define explicit node-to-band mapping for imports, external re-exports, local public API, and private declarations.
- [ ] 1.3 Validate how eager-initialization and comment-safety checks interact with the new banding model.

## 2. read-friendly-order Implementation

- [ ] 2.1 Update top-level ordering logic to enforce canonical band order: imports -> external re-exports -> local public API -> private declarations.
- [ ] 2.2 Keep consumer-first dependency ordering within each band.
- [ ] 2.3 Add local `export default` priority at the top of the local public API band when movement is safe.
- [ ] 2.4 Split external re-export detection from local export-list classification so they no longer share a single bucket.

## 3. export-control Implementation

- [ ] 3.1 Update `src/rules/export-control/index.ts` so wildcard `export * from ...` is rejected in all files.
- [ ] 3.2 Preserve existing symbol-contract behavior for named and default exports.

## 4. RuleTester Coverage

- [ ] 4.1 Add `read-friendly-order` scenarios for mixed top-level bands and deterministic canonical output.
- [ ] 4.2 Add scenarios proving external re-exports remain above local public exports.
- [ ] 4.3 Add scenarios proving local export lists are grouped with local public API (not external re-exports).
- [ ] 4.4 Add scenarios proving local `export default` is prioritized within the local public band when safe.
- [ ] 4.5 Add `export-control` scenario(s) where non-entrypoint `export * from ...` is rejected.

## 5. Verification

- [ ] 5.1 Run targeted tests for `read-friendly-order` and `export-control` and resolve failures.
- [ ] 5.2 Run `npm run fix`, then `npm run verify`, then `npm run test`.
