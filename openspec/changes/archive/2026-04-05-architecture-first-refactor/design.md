## Context

`no-false-sharing` currently reads its configuration from rule-level options (`options[0].dirs`), while `import-control` and `export-control` read from `settings.unslop.architecture`. This split means users must declare shared directories in two places, and the rules use different internal machinery despite enforcing related concerns. The `shared: boolean` field already exists on `ArchitectureModulePolicy` but is never consumed — it was a placeholder waiting for this change.

The `configs.recommended` name is misleading: it contains only the zero-config symbol fixers, not the architecture rules that are the plugin's primary value proposition. There is no shareable config that bundles the architecture rules.

## Goals / Non-Goals

**Goals:**

- `no-false-sharing` reads from `settings.unslop.architecture` (same source as import/export-control)
- Modules marked `shared: true` in architecture settings are subject to false-sharing enforcement
- Project root derivation uses the same sourceRoot path approach as the rest of the architecture machinery
- `file` mode consumer counting is removed; directory mode is the only mode
  - `configs.minimal` replaces `configs.recommended` (zero-config symbol fixers)
- `configs.full` is added (architecture enforcement plus read-friendly-order, requires `settings.unslop.architecture`)
- README positions architecture enforcement as primary

**Non-Goals:**

- No changes to import-control or export-control rule logic
- No changes to the `shared: true` parsing in `readArchitecturePolicy` — it already works
- No new ESLint settings keys or schema extensions beyond activating what's already parsed
- No migration tooling or codemods for users updating from old `no-false-sharing` options

## Decisions

### Decision: no-false-sharing derives project root from sourceRoot in the filename path

**Current approach**: `findProjectRoot()` finds the last occurrence of `/<sharedDirName>/` in the filename and takes everything before it.

**New approach**: When `sourceRoot` is set in the architecture policy, derive project root by finding `/<sourceRoot>/` in the absolute filename and taking everything before it. When `sourceRoot` is not set, the rule fails gracefully and does not report for the file. This keeps behavior predictable and avoids fragile path heuristics. This is aligned with how architecture path handling relies on `sourceRoot` markers.

**Why not `context.getCwd()`**: Consistency. All other architecture machinery uses path derivation from the filename. Introducing a new API surface for one rule would be inconsistent and harder to test with fixture-based tests (where `cwd` may not match the fixture path).

**Practical shape**: Extract a `deriveProjectRoot(filename, sourceRoot)` helper that mirrors `applySourceRoot` in reverse — find the sourceRoot marker in the path, return the prefix.

### Decision: matched modules drive which files are checked, not directory name scanning

**Current approach**: `findMatchingDir()` checks if `/<dirName>/` appears anywhere in the posix filename.

**New approach**: `matchFileToArchitectureModule()` is called on the filename; if the matched module has `policy.shared === true`, the file is subject to the check. This reuses the existing module matching logic (wildcard support, specificity ordering, sourceRoot handling) instead of a separate string scan.

**Why**: Single matching engine across all architecture rules. A file declared as `shared/*: { shared: true }` is matched by the architecture module matcher, not by ad-hoc path string search.

### Decision: consumer counting is always directory mode; file mode is dropped

**Current approach**: `no-false-sharing` accepts a `mode: 'file' | 'dir'` option (per-directory or globally) that controls whether consumers are counted by individual file or by top-level directory.

**New approach**: directory mode only. A consumer is always a top-level directory (first path segment relative to project root). File mode is removed entirely.

**Why**: The plugin is moving toward enforcing barrel exports via `export-control`. When barrel exports are enforced, all imports from a shared module arrive through its `index.ts` — making every importer in the same directory indistinguishable at the file level anyway. File mode becomes meaningless in that world. Removing it simplifies the rule, the schema, and the mental model.

**Breaking**: Any project using `mode: 'file'` must migrate to directory mode. In practice the behavior difference only matters if two files in the same directory both import a shared module — with barrel exports enforced, that case shouldn't arise.

### Decision: no-false-sharing schema becomes `[]`

The rule takes no options. All configuration comes from `settings.unslop.architecture`. This is consistent with how `import-control` and `export-control` are configured (both also have `schema: []`).

**Breaking**: Any existing `no-false-sharing` config using `options[0].dirs` will silently stop working (ESLint will ignore unknown options by default). This must be documented as a breaking change.

### Decision: configs.minimal and configs.full replace configs.recommended

- `configs.minimal`: contains only `no-special-unicode` and `no-unicode-escape`. Zero config, safe to add to any project. Same rules as current `recommended`, new name.
- `configs.full`: enables `import-control`, `export-control`, `no-false-sharing`, and `read-friendly-order` in addition to the minimal rules. Requires `settings.unslop.architecture` to be set by the user — without it the architecture rules no-op gracefully.

**Why not keep `recommended` as an alias**: Keeping it would perpetuate the misleading name. A clean break is better; the version bump signals the change.

**Why `full` includes `read-friendly-order`**: The full profile is the project's comprehensive strictness preset. Including readability enforcement keeps `configs.full` aligned with the documented default rule suite and current plugin behavior.

## Risks / Trade-offs

- **Breaking change for `no-false-sharing` users**: Any project using `no-false-sharing` with rule options will need to migrate to `settings.unslop.architecture`. This is unavoidable given the design goal. Mitigation: clear documentation in README and changelog.
- **`configs.recommended` rename is breaking**: Projects spreading `unslop.configs.recommended` will get a lint error after upgrading. Mitigation: document prominently, keep change in a minor or major version bump.
- **No `file` mode**: Projects relying on file-mode consumer counting lose that capability. Given the direction toward barrel exports (where module = directory), this is acceptable. Mitigation: document removal.
- **sourceRoot required for enforcement**: If a user marks `utils: { shared: true }` but has no `sourceRoot`, `no-false-sharing` will no-op for those files rather than attempting path heuristics. Mitigation: encourage `sourceRoot` in docs; this behavior is graceful and avoids false positives from ambiguous path matching.

## Migration Plan

1. Update `no-false-sharing` rule implementation and tests
2. Update `src/index.ts` — rename `recommended` to `minimal`, add `full`
3. Update `eslint.config.mjs` — add `shared: true` to `utils` module in architecture settings, remove `no-false-sharing` rule options
4. Update README — rewrite framing and quick start
5. Bump version (breaking change)

No rollback complexity — all changes are local to the plugin package and its config files.

## Open Questions

- None. Design is fully determined by the exploration session.
