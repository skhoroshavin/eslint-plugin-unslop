## 1. Export-Control Coverage

- [x] 1.1 Read `src/rules/export-control/index.ts` and `src/rules/export-control/index.test.ts` against the spec delta to map which export shapes already have end-to-end coverage.
- [x] 1.2 Add RuleTester scenarios for non-entrypoint files in constrained modules so value exports and type exports both stay outside symbol-contract enforcement.
- [x] 1.3 Add RuleTester scenarios for constrained entrypoints covering direct named exports, direct type exports, source-bearing named exports, and default exports for both allowed and denied cases.

## 2. Rule Alignment

- [x] 2.1 Run the targeted `export-control` test file and confirm whether the new scenarios match the current implementation.
- [x] 2.2 If any new scenario fails, make the smallest change in `src/rules/export-control/index.ts` needed to align behavior with the clarified spec.
- [x] 2.3 Re-run the targeted `export-control` tests until the new and existing scenarios pass together.

## 3. Verification

- [x] 3.1 Run `npm run fix` if the test or rule edits introduce lint or formatting issues.
- [x] 3.2 Run `npm run verify` and fix any failures caused by the change.
- [x] 3.3 Run `npm run test` and confirm the full suite passes.
