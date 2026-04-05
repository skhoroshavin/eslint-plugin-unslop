## 1. Update no-false-sharing rule

- [ ] 1.1 Add `deriveProjectRoot(filename, sourceRoot)` helper to `no-false-sharing/index.ts` — finds `/<sourceRoot>/` in filename and returns the prefix
- [ ] 1.2 Replace `create()` option reading with `readArchitecturePolicy(context)`; filter modules where `policy.shared === true` to get the list of checked modules
- [ ] 1.3 Replace `findMatchingDir()` call with `matchFileToArchitectureModule()`; check `policy.shared === true` on the matched module
- [ ] 1.4 Replace `findProjectRoot()` call with the new `deriveProjectRoot()` helper
- [ ] 1.5 Remove `getConfigDirs()`, `findMatchingDir()`, `findProjectRoot()`, `toPosix()`, and all `DirConfig` / `mode` related code
- [ ] 1.6 Drop the `schema` to `[]` and remove all rule-level options handling
- [ ] 1.7 Simplify `getEntityName()` and `findConsumers()` — remove the `mode` parameter, always use directory mode

## 2. Update no-false-sharing tests

- [ ] 2.1 Rewrite all `assertValid` / `assertInvalid` call sites to pass `settings: { unslop: { sourceRoot: '...', architecture: { ...: { shared: true } } } }` instead of `options`
- [ ] 2.2 Remove `SHARED_DIR_FILE_MODE` and file-mode test cases entirely
- [ ] 2.3 Keep dir-mode behavior tests; rename/adjust as needed to reflect the new config shape
- [ ] 2.4 Run `npm run test -- src/rules/no-false-sharing/index.test.ts` and confirm all pass

## 3. Update plugin configs

- [ ] 3.1 In `src/index.ts`, rename `recommended` to `minimal` (name and config object)
- [ ] 3.2 Add `configs.full` enabling `import-control`, `export-control`, `no-false-sharing`, `no-special-unicode`, and `no-unicode-escape` at error severity
- [ ] 3.3 Verify `configs.recommended` is not exported (access returns `undefined`)

## 4. Update repository self-lint config

- [ ] 4.1 In `eslint.config.mjs`, add `shared: true` to the `utils` module policy in `settings.unslop.architecture`
- [ ] 4.2 Remove the `'unslop/no-false-sharing': ['error', { dirs: [...] }]` rule entry (if present) and replace with `'unslop/no-false-sharing': 'error'`
- [ ] 4.3 Run `npm run verify` and confirm it exits clean

## 5. Update README

- [ ] 5.1 Rewrite the opening description to lead with architecture enforcement
- [ ] 5.2 Rewrite Quick Start to show the full architecture config (`configs.full` + `settings.unslop.architecture` block) as the primary example
- [ ] 5.3 Add a note that `configs.minimal` (zero-config symbol fixers) is included automatically within `configs.full`, or can be used standalone
- [ ] 5.4 Reorder the rules section: architecture rules first (`import-control`, `export-control`, `no-false-sharing`), symbol/style rules second
- [ ] 5.5 Update `no-false-sharing` documentation: remove `dirs` / `mode` options table; show `shared: true` in architecture settings as the configuration mechanism
- [ ] 5.6 Update any references to `configs.recommended` → `configs.minimal`

## 6. Final verification

- [ ] 6.1 Run `npm run fix` and address anything it cannot auto-fix
- [ ] 6.2 Run `npm run verify` — must exit clean
- [ ] 6.3 Run `npm run test` — all tests must pass
