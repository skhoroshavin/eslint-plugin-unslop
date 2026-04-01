## 1. Autofix foundation and safety guards

- [x] 1.1 Add `fixable: 'code'` support and shared reorder utility primitives for deterministic, stable ordering in `read-friendly-order` modules.
- [x] 1.2 Implement region safety checks (valid/non-overlapping ranges, unsupported syntax detection, ambiguous comment/trivia guard) that gate autofix emission.
- [x] 1.3 Add idempotence-focused helper coverage to ensure canonical ordering reaches a fixed point.

## 2. Top-level and class-member autofix implementation

- [x] 2.1 Implement canonical top-level declaration reordering fix generation for helper/constant diagnostics while preserving current cycle and eager-use protections.
- [x] 2.2 Implement canonical class-member reordering fix generation for constructor-first, public-field block ordering, and member dependency ordering diagnostics.
- [x] 2.3 Ensure unsafe or unsupported top-level/class regions remain report-only with no emitted fix.

## 3. Test-phase autofix implementation

- [x] 3.1 Implement canonical test-phase reordering fix generation for setup, teardown, and test-call ordering diagnostics.
- [x] 3.2 Preserve stable relative order inside each phase bucket to avoid unnecessary churn.
- [x] 3.3 Verify test-phase fixes compose correctly with other `read-friendly-order` fix domains in the same file.

## 4. Validation and regression coverage

- [x] 4.1 Expand `src/rules/read-friendly-order.test.ts` with fixed-output cases for top-level, class, and test-phase reorderings.
- [x] 4.2 Add no-fix regression cases for ambiguous comments, unsupported syntax, and cyclic dependency groups.
- [x] 4.3 Run `npm run fix`, `npm run verify`, and `npm run test`, and address any failures.
