## 1. Baseline review and fixture planning

- [ ] 1.1 Read `src/rules/import-control/index.ts`, `src/utils/architecture-policy.ts`, and `src/rules/import-control/index.test.ts` to map current hardcoded entrypoint behavior.
- [ ] 1.2 Identify existing import-control scenarios to update for `entrypoints` defaults (`index.ts` only) and anonymous-module fallback behavior.

## 2. Architecture policy updates

- [ ] 2.1 Extend architecture module policy types/parsing to support `entrypoints: string[]`.
- [ ] 2.2 Normalize configured modules to default `entrypoints` to `['index.ts']` when omitted.
- [ ] 2.3 Keep default anonymous module policy strict with `imports: []` and effective cross-module entrypoint allowance of `index.ts` only.

## 3. Import-control behavior changes

- [ ] 3.1 Replace hardcoded public-entrypoint checks in cross-module validation with target-module `entrypoints` checks based on resolved target file.
- [ ] 3.2 Preserve shallow relative child-entrypoint allowance, but drive it from target-module configured/defaulted entrypoints.
- [ ] 3.3 Update rule metadata/messages to reflect configuration-driven entrypoints instead of fixed `index.ts`/`types.ts` wording.

## 4. RuleTester coverage

- [ ] 4.1 Add/adjust tests for explicit `entrypoints` allow/deny behavior on cross-module imports.
- [ ] 4.2 Add tests for configured-module default behavior (`entrypoints` omitted implies `index.ts` only).
- [ ] 4.3 Add tests for anonymous/unmatched-module fallback (`index.ts` allowed candidate, non-`index.ts` rejected).
- [ ] 4.4 Keep alias and specifier-variant coverage to ensure resolved-target matching continues to allow equivalent entrypoint specifiers.

## 5. Verification and cleanup

- [ ] 5.1 Run `npm run fix` and address any remaining autofix/lint issues.
- [ ] 5.2 Run `npm run verify` and fix any type/build/lint regressions.
- [ ] 5.3 Run `npm run test` to confirm full suite passes with updated import-control behavior.
