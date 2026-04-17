## 1. Shared Architecture Policy

- [ ] 1.1 Read `src/utils/architecture-policy.ts`, `src/utils/index.ts`, and `src/utils/test-fixtures/index.ts` to confirm all shared policy types and exports that need the new `typeImports` field.
- [ ] 1.2 Update shared architecture policy parsing and defaults so module policies and anonymous modules include optional `typeImports` normalized to an empty list.
- [ ] 1.3 Extend any shared test fixture types needed to express `typeImports` in RuleTester scenarios without changing existing callers.

## 2. Import Control Behavior

- [ ] 2.1 Read `src/rules/import-control/index.ts` and `src/rules/import-control/index.test.ts` to map the current allowlist and entrypoint checks before editing behavior.
- [ ] 2.2 Implement type-only declaration detection in `import-control`, including declaration-level and specifier-level type-only syntax while keeping mixed/value imports on `imports` only.
- [ ] 2.3 Reuse the existing import pattern matcher so type-only cross-module edges are allowed by the union of `imports` and `typeImports` without changing namespace or entrypoint enforcement.

## 3. Test Coverage

- [ ] 3.1 Add RuleTester scenarios covering omitted `typeImports` defaults and anonymous-module defaults through architecture-aware rule behavior.
- [ ] 3.2 Add `import-control` scenarios for type-only imports allowed by `imports`, allowed by `typeImports`, rejected mixed imports that only match `typeImports`, and non-entrypoint type-only imports.

## 4. Verification

- [ ] 4.1 Run `npm run fix` and address any autofixes needed for the touched files.
- [ ] 4.2 Run `npm run verify` and fix any reported issues.
- [ ] 4.3 Run `npm run test` and confirm the full test suite passes.
