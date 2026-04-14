## 1. Align specs and diagnostics contract

- [x] 1.1 Review delta specs in `openspec/changes/require-tsconfig/specs/` and confirm final error scenarios/messages to implement
- [x] 1.2 Define a stable configuration-error message template that includes linted file path and tsconfig/search-root context

## 2. Refactor shared TypeScript context utilities

- [x] 2.1 Update `src/utils/ts-program.ts` to return structured context status (active vs configuration error) instead of bare `undefined` for required-context callers
- [x] 2.2 Update `src/utils/architecture-policy.ts` to preserve true out-of-scope inactive paths, but surface configuration-error status when tsconfig is missing/invalid/non-inclusive
- [x] 2.3 Remove or downgrade console-warning-only behavior that previously hid context failures

## 3. Update rules to fail explicitly on context errors

- [x] 3.1 Update `src/rules/import-control/index.ts` to report a dedicated configuration error message when context status is error
- [x] 3.2 Update `src/rules/no-false-sharing/index.ts` to report a dedicated configuration error message when context status is error
- [x] 3.3 Update `src/rules/no-single-use-constants/index.ts` to report a dedicated configuration error message when context status is error
- [x] 3.4 Update `src/rules/no-whitebox-testing/index.ts` to keep no-op without architecture settings, but report configuration error when settings are present and semantic context fails

## 4. Update and expand rule tests

- [x] 4.1 Replace existing no-op expectations with explicit error assertions in `src/rules/import-control/index.test.ts`
- [x] 4.2 Replace existing no-op expectations with explicit error assertions in `src/rules/no-false-sharing/index.test.ts`
- [x] 4.3 Replace existing no-op expectations with explicit error assertions in `src/rules/no-single-use-constants/index.test.ts`
- [x] 4.4 Replace existing no-op expectations with explicit error assertions in `src/rules/no-whitebox-testing/index.test.ts`
- [x] 4.5 Add scenarios that assert diagnostics include actionable path context (linted file + tsconfig/search root details)

## 5. Validate plugin config behavior and quality gates

- [x] 5.1 Update config-level tests/spec assertions to reflect explicit failures under `configs.full` when required tsconfig context is unusable
- [x] 5.2 Run targeted vitest files for impacted rules and fix failures
- [x] 5.3 Run `npm run fix`, then `npm run verify`, then `npm run test`
