## 1. Shared TypeScript Project Infrastructure

- [ ] 1.1 Replace `src/utils/tsconfig-resolution.ts` with a TypeScript-backed project utility that discovers the nearest `tsconfig.json`, parses it through the compiler API, and caches one `ProjectContext` per resolved tsconfig path.
- [ ] 1.2 Thread the new `ProjectContext` through architecture-policy utilities so project root and source-root derivation continue to work for existing module-matching scenarios.
- [ ] 1.3 Remove the `get-tsconfig` dependency and delete now-obsolete alias/path probing helpers that are superseded by the shared TypeScript project utility.

## 2. Import-Control Migration

- [ ] 2.1 Update `src/rules/import-control/index.ts` to resolve local targets through the shared `ProjectContext` while preserving the current allowlist, entrypoint, namespace-import, and depth-limit behavior.
- [ ] 2.2 Run the existing `src/rules/import-control/index.test.ts` suite against the new implementation and only add scenarios for semantic-project fail-open behavior if the current suite does not already cover it.

## 3. No-False-Sharing Migration

- [ ] 3.1 Replace regex-based importer scanning in `src/rules/no-false-sharing/index.ts` with TypeScript checker-driven export and import analysis based on canonical symbol identity.
- [ ] 3.2 Preserve current consumer-group semantics while mapping public entrypoint imports and same-module internal usage onto canonical exported symbols.
- [ ] 3.3 Run the existing `src/rules/no-false-sharing/index.test.ts` suite against the new implementation and add only the minimal new scenarios needed for semantic-project fail-open behavior or symbol-resolution edge cases not already covered.

## 4. Verification And Cleanup

- [ ] 4.1 Remove any remaining architecture-rule call sites that still depend on handwritten local resolution utilities.
- [ ] 4.2 Run `npm run fix`, then `npm run verify`, then `npm run test`, and resolve any regressions while keeping behavior aligned with the existing architecture rule scenarios.
