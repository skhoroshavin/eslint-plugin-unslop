## 1. Rule and fixture baseline

- [ ] 1.1 Read `no-false-sharing`, `import-control`, and `export-control` implementations plus their colocated tests to document current entrypoint, alias, and namespace behaviors
- [ ] 1.2 Identify and update shared path/import resolver helpers needed for consistent local relative and `@/...` alias target normalization

## 2. no-false-sharing symbol enforcement

- [ ] 2.1 Replace file-level false-sharing checks with shared-entrypoint exported symbol analysis (`index.ts`/`types.ts`) and per-symbol consumer aggregation
- [ ] 2.2 Count both value imports and `import type` imports as symbol consumers across local project files
- [ ] 2.3 Update rule diagnostics to report symbol name, consumer count, and the single consumer group when exactly one consumer is found
- [ ] 2.4 Add/refresh RuleTester scenarios for alias consumer counting, zero-consumer symbols, one-consumer symbols, and multi-consumer pass cases

## 3. import-control and export-control tightening

- [ ] 3.1 Add `import-control` enforcement to reject local cross-module `import * as Namespace from '...'` while allowing external dependency namespace imports
- [ ] 3.2 Add or tighten `export-control` enforcement to reject `export * from ...` in shared module `index.ts`/`types.ts` entrypoints
- [ ] 3.3 Add/refresh RuleTester scenarios covering local namespace import rejection, external namespace import allowance, and shared-entrypoint `export *` rejection

## 4. Spec-to-test traceability

- [ ] 4.1 Ensure each new or modified OpenSpec scenario has a corresponding `scenario()` test case in the relevant rule test files
- [ ] 4.2 Update rule docs/messages where needed so behavior and migration expectations match the new symbol-level architecture contract

## 5. Verification and cleanup

- [ ] 5.1 Run `npm run fix` and address any remaining lint/format/unused issues
- [ ] 5.2 Run `npm run verify` and resolve failures
- [ ] 5.3 Run `npm run test` to confirm full suite passes
