## 1. Rule groundwork

- [ ] 1.1 Read the existing architecture helpers, `import-control`, and the test-conventions spec to mirror current resolution and RuleTester patterns.
- [ ] 1.2 Inspect plugin rule registration and full-config wiring to identify every place `no-whitebox-testing` must be exposed.

## 2. Rule implementation

- [ ] 2.1 Create `src/rules/no-whitebox-testing/index.ts` with metadata, supported test-file detection, and fail-open behavior when architecture analysis is unavailable.
- [ ] 2.2 Implement import resolution logic that reports only same-directory private imports within the current module instance while allowing configured module entrypoints.
- [ ] 2.3 Add a report message that explains the public-entrypoint requirement and includes the offending import specifier.

## 3. Tests and config wiring

- [ ] 3.1 Add colocated RuleTester scenarios covering all supported test filename patterns, allowed entrypoint imports, denied same-directory private imports, ignored child-submodule imports, ignored cross-module imports, and fail-open cases.
- [ ] 3.2 Register `no-whitebox-testing` in the plugin rule map and export surface.
- [ ] 3.3 Add `unslop/no-whitebox-testing` to `configs.full` at error severity and update any affected config or documentation snapshots.

## 4. Verification

- [ ] 4.1 Run `npm run fix` and address any remaining autofixable issues.
- [ ] 4.2 Run `npm run verify` and fix any failures.
- [ ] 4.3 Run `npm run test` and confirm the full test suite passes.
