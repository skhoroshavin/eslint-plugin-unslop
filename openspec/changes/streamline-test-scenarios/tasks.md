## 1. Update shared scenario fixture contract

- [x] 1.1 Refactor `src/utils/test-fixtures/index.ts` types to a `SimpleScenario | FullScenario` union without discriminator fields
- [x] 1.2 Reuse RuleTester-native error typing for expected errors and keep optional `typescript`, `settings`, and `output` fields on both scenario shapes
- [x] 1.3 Implement strict full-scenario validation that requires a `files` entry matching `filename` with explicit `content`
- [x] 1.4 Convert simple and full scenarios directly to RuleTester cases without introducing an intermediate normalization model

## 2. Migrate full scenarios that are already content-complete

- [x] 2.1 Remove duplicated top-level `code` from full scenarios in `src/rules/no-single-use-constants/index.test.ts`
- [x] 2.2 Remove duplicated top-level `code` from full scenarios in `src/rules/no-false-sharing/index.test.ts`

## 3. Migrate full scenarios that need target file content

- [x] 3.1 Update `src/rules/export-control/index.test.ts` full scenarios to add target file `content` in `files` and remove duplicated top-level `code`
- [x] 3.2 Update `src/rules/no-whitebox-testing/index.test.ts` full scenarios to add target file `content` in `files` and remove duplicated top-level `code`
- [x] 3.3 Update `src/rules/import-control/index.test.ts` full scenarios to add target file `content` in `files` and remove duplicated top-level `code`

## 4. Validate behavior and compatibility

- [x] 4.1 Run targeted Vitest suites for migrated rule test files and fix any fixture validation failures
- [x] 4.2 Run `npm run test` to confirm all rule tests pass with the new scenario contract
- [x] 4.3 Run `npm run verify` and address any lint/type/format issues introduced by the migration

## 5. Final cleanup and reviewability

- [x] 5.1 Ensure full-scenario setup error messages are explicit enough to diagnose missing `filename`/`content` fixture issues quickly
- [x] 5.2 Review changed tests for single source of truth in file-backed cases and remove leftover duplicated lint source declarations
