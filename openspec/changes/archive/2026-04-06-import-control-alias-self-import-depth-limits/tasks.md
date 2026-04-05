## 1. Rule Analysis and Test Planning

- [x] 1.1 Review `src/rules/import-control/index.ts`, related helpers, and existing import-control tests to confirm current same-module depth and alias resolution behavior.
- [x] 1.2 Identify the minimal helper and visitor touchpoints needed to enforce same-module depth by resolved target identity for both `./` and `@/...` imports.

## 2. Import-Control Implementation

- [x] 2.1 Update import-control same-module depth evaluation to run after local target resolution so alias and relative self-imports use identical depth semantics with no exceptions.
- [x] 2.2 Keep cross-module checks unchanged by preserving existing policy and public-entrypoint (`index.ts`/`types.ts`) behavior.
- [x] 2.3 Add or adjust small helper logic as needed to keep complexity and file-level guardrails compliant.

## 3. RuleTester Coverage

- [x] 3.1 Add a scenario where same-module shallow relative import is allowed.
- [x] 3.2 Add a scenario where same-module deep relative import is rejected.
- [x] 3.3 Add a scenario where same-module deep source-root alias self-import is rejected.
- [x] 3.4 Add a scenario where cross-module source-root alias import to a public entrypoint is allowed when dependency policy permits.

## 4. Verification and Cleanup

- [x] 4.1 Run `npm run test -- src/rules/import-control/index.test.ts` and resolve any failures.
- [x] 4.2 Run `npm run fix`, then `npm run verify`, then `npm run test`.
