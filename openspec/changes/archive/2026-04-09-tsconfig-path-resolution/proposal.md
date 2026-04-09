## Why

The plugin hardcodes `@/` as the only recognized path alias and requires a manual `settings.unslop.sourceRoot` to resolve it. This duplicates information that already lives in `tsconfig.json` (`compilerOptions.paths`, `rootDir`, `baseUrl`), forces users to keep two configs in sync, and silently ignores any non-`@/` aliases the project actually uses. Reading tsconfig directly removes the duplication, supports arbitrary aliases, and makes project root derivation reliable instead of fragile string-matching.

## What Changes

- **BREAKING**: Remove `settings.unslop.sourceRoot`. Source root is derived from tsconfig (`rootDir`, then inferred from `paths` targets, then `baseUrl`).
- **BREAKING**: Remove hardcoded `@/` alias handling. All alias resolution comes from `compilerOptions.paths`.
- Add `get-tsconfig` as a runtime dependency for reading and resolving tsconfig at lint time.
- Add a new utility module (`tsconfig-resolver` or similar) that provides cached tsconfig reading, path alias resolution, source root derivation, and project root derivation.
- Modify `architecture-policy.ts` to use the new tsconfig-based resolution instead of `sourceRoot` string-matching and `@/`-specific logic.
- Modify `no-false-sharing` to derive project root and source directory from tsconfig location rather than scanning for `/<sourceRoot>/` in file paths.
- Alias resolution supports prefix rewrites (`"@/*": ["src/*"]`) and exact matches (`"@config": ["src/config"]`). Multiple candidate targets per pattern are not supported (first target wins).
- When no tsconfig is found or source root cannot be derived, architecture rules emit a warning and become no-ops (consistent with current behavior when `sourceRoot` is missing).

## Capabilities

### New Capabilities

- `tsconfig-resolution`: Reading tsconfig.json via `get-tsconfig`, caching per tsconfig path, deriving source root and project root from compiler options, and resolving path aliases from `compilerOptions.paths`.

### Modified Capabilities

- `architecture-import-export-control`: Alias resolution changes from hardcoded `@/` to tsconfig-driven paths. Source root derivation changes from manual setting to tsconfig. Module matching path-stripping changes from string-search to tsconfig-based project root. The `sourceRoot` setting is removed.
- `no-false-sharing-symbol-analysis`: Project root derivation changes from `/<sourceRoot>/` string-search in filename to `dirname(tsconfig.json)`. Source tree scanning root changes from manual `sourceRoot` setting to tsconfig-derived source root. Alias resolution during consumer scanning uses tsconfig paths instead of hardcoded `@/`.

## Impact

- **Runtime dependency added**: `get-tsconfig` (small, well-maintained, already a transitive dep via `tsx` and `knip`).
- **Breaking config change**: Users must remove `settings.unslop.sourceRoot` from their ESLint config. Projects need a `tsconfig.json` with `rootDir` or `paths` for architecture rules to function.
- **Affected rules**: `import-control`, `export-control`, `no-false-sharing`. All three use path resolution and module matching.
- **Unaffected rules**: `no-special-unicode`, `no-unicode-escape`, `read-friendly-order` (no path resolution).
- **Test infrastructure**: Test fixtures that set `settings.unslop.sourceRoot` will need tsconfig fixtures instead. The existing `makeFsTester` in test-fixtures already supports writing `tsconfig.json` to temp dirs.
- **Self-linting**: The project's own `eslint.config.mjs` removes `sourceRoot: 'src'` and relies on its `tsconfig.json` which already has `rootDir: "./src"`.
