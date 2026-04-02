## 1. Regression coverage

- [ ] 1.1 Add a top-level ordering test case where an eagerly invoked top-level symbol transitively reads a helper/constant and assert no report.
- [ ] 1.2 Add a transitive eager call-path test variant (entrypoint -> intermediate symbol -> helper/constant) and assert no report.
- [ ] 1.3 Add or retain a non-eager control case to confirm existing reorder diagnostics still fire.

## 2. Eager reachability analysis

- [ ] 2.1 Refactor top-level eager detection to compute eager roots from module/global runtime references.
- [ ] 2.2 Build transitive symbol dependency traversal for relevant top-level symbols and derive eager-excluded helper/constant names.
- [ ] 2.3 Reuse eager-excluded names in both report gating and top-level reorder edge construction.

## 3. Validation

- [ ] 3.1 Run targeted tests for `src/rules/read-friendly-order/index.test.ts` and `src/rules/read-friendly-order/autofix.test.ts`.
- [ ] 3.2 Run `npm run test` (and `npm run verify` if needed) to confirm no regressions outside the rule.
