## 1. Add dependency and create tsconfig-resolution utility

- [x] 1.1 Add `get-tsconfig` as a runtime dependency in `package.json` and run `npm install`
- [x] 1.2 Create `src/utils/tsconfig-resolution.ts` with `getTsconfigInfo(filename)` that locates the nearest tsconfig via `getTsconfig`, derives `projectRoot` from `dirname(tsconfigPath)`, derives `sourceRoot` using the priority chain (rootDir > paths inference > baseUrl), creates the `pathsMatcher` via `createPathsMatcher`, and caches results per tsconfig path
- [x] 1.3 Add `resolvePathAlias(specifier, info)` to `tsconfig-resolution.ts` that delegates to the cached `pathsMatcher`, takes the first result, and runs it through the existing `resolveExistingFile` extension probing logic
- [x] 1.4 Export `getTsconfigInfo`, `resolvePathAlias`, and the `TsconfigInfo` type from `src/utils/index.ts`

## 2. Modify architecture-policy.ts

- [x] 2.1 Change `ArchitecturePolicy` interface: remove `sourceRoot?: string`, add `tsconfigInfo: TsconfigInfo`
- [x] 2.2 Update `readArchitecturePolicy(context)` to call `getTsconfigInfo(context.filename)` and store the result in the returned policy instead of reading `sourceRoot` from settings; remove `getSourceRoot` helper
- [x] 2.3 Update `applySourceRoot` to use `tsconfigInfo.projectRoot` and `tsconfigInfo.sourceRoot` with `node_path.relative` instead of string-searching for `/<sourceRoot>/`
- [x] 2.4 Update `resolveImportTarget` signature to accept `TsconfigInfo` instead of `sourceRoot: string | undefined`; replace the `@/`-specific `resolveAliasImport` with a call to `resolvePathAlias`
- [x] 2.5 Update `isLocalSpecifier` to accept the `pathsMatcher` and use it to determine if a non-relative specifier is local (replacing the hardcoded `@/` check)
- [x] 2.6 Remove dead code: `getSourceRoot`, `resolveAliasImport`, `resolveInsideSourceRoot` (the `/<sourceRoot>/` containment check)

## 3. Update import-control rule

- [x] 3.1 Update `getTargetFile` in `import-control/index.ts` to pass `policy.tsconfigInfo` to `resolveImportTarget` instead of `policy.sourceRoot`
- [x] 3.2 Run `import-control` tests to confirm existing behavior is preserved: `npm run test -- src/rules/import-control/index.test.ts`

## 4. Update export-control rule

- [x] 4.1 Verify `export-control/index.ts` needs no direct changes (it only calls `readArchitecturePolicy` and `matchFileToArchitectureModule`, which are updated in step 2); confirm by reading the rule
- [x] 4.2 Run `export-control` tests to confirm existing behavior is preserved: `npm run test -- src/rules/export-control/index.test.ts`

## 5. Update no-false-sharing rule

- [x] 5.1 Update `no-false-sharing/index.ts`: replace `deriveProjectRoot(filename, sourceRoot)` with `policy.tsconfigInfo.projectRoot`; derive `sourceDir` from `tsconfigInfo.projectRoot + tsconfigInfo.sourceRoot`
- [x] 5.2 Update `getImportedSymbols` to pass `TsconfigInfo` to `resolveImportTarget` instead of `sourceRoot` string
- [x] 5.3 Remove the `deriveProjectRoot` helper function from `no-false-sharing/index.ts`
- [x] 5.4 Run `no-false-sharing` tests to confirm existing behavior is preserved: `npm run test -- src/rules/no-false-sharing/index.test.ts`

## 6. Update test fixtures

- [x] 6.1 Update `import-control` test scenarios: replace `settings.unslop.sourceRoot` with `tsconfig.json` files in the `files` array containing appropriate `compilerOptions.rootDir` and/or `compilerOptions.paths`; update alias test cases to use `tsconfig.json` paths configuration
- [x] 6.2 Update `export-control` test scenarios: replace `settings.unslop.sourceRoot` with `tsconfig.json` files in the `files` array
- [x] 6.3 Update `no-false-sharing` test scenarios: replace `settings.unslop.sourceRoot` with `tsconfig.json` files; update `@/` alias test cases to use `tsconfig.json` paths configuration
- [x] 6.4 Run full test suite: `npm run test`

## 7. Update self-linting and documentation

- [x] 7.1 Update `eslint.config.mjs`: remove `sourceRoot: 'src'` from `settings.unslop` (the project's `tsconfig.json` already has `rootDir: "./src"`)
- [x] 7.2 Update `README.md`: remove `sourceRoot` from config examples; add note about `tsconfig.json` requirement for architecture rules; update alias documentation to reference `compilerOptions.paths`

## 8. Verification

- [x] 8.1 Run `npm run fix` to apply auto-fixes
- [x] 8.2 Run `npm run verify` (prettier, knip, depcruise, jscpd, tsc, tsup, eslint) -- must exit clean
- [x] 8.3 Run `npm run test` -- all tests must pass
