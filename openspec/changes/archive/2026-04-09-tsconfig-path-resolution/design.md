## Context

Three architecture rules (`import-control`, `export-control`, `no-false-sharing`) depend on resolving path aliases and deriving the project's source root. Today this is done via a manual `settings.unslop.sourceRoot` string and a hardcoded `@/` alias prefix. The `sourceRoot` is located by string-searching for `/<sourceRoot>/` in absolute file paths, and aliases are resolved by concatenating `projectRoot + sourceRoot + remainder`.

This approach has three problems: it only supports `@/` aliases, it duplicates what `tsconfig.json` already declares, and the string-search for `/<sourceRoot>/` is fragile (breaks if the segment appears elsewhere in the path).

The change replaces all of this with `tsconfig.json` as the single source of truth for path aliases, source root, and project root.

## Goals / Non-Goals

**Goals:**

- Remove `settings.unslop.sourceRoot` from the plugin's configuration surface
- Support arbitrary path aliases as declared in `compilerOptions.paths` (prefix rewrites and exact matches)
- Derive project root reliably from tsconfig file location instead of string-matching
- Derive source root from `compilerOptions.rootDir` (or infer it from `paths` targets)
- Cache tsconfig reads so each unique tsconfig path is parsed once per lint run
- Maintain all existing rule behavior -- the resolution mechanism changes, the architectural enforcement semantics do not

**Non-Goals:**

- Supporting multiple candidate targets per `paths` entry (first target wins)
- Supporting custom tsconfig file names (e.g., `tsconfig.app.json`) in the initial version
- Replacing the file extension probing logic (`resolveExistingFile`) -- that stays as-is
- Reading tsconfig through typescript-eslint parser services (see Decision 1)
- Supporting projects that have no `tsconfig.json` for architecture rules -- they get a warning and rules become no-ops

## Decisions

### Decision 1: Use `get-tsconfig` for tsconfig reading, not parser services

**Choice:** Read tsconfig via the `get-tsconfig` library.

**Alternative considered:** Access `compilerOptions` through `context.sourceCode.parserServices.program.getCompilerOptions()`.

**Rationale:**

- Parser services require type-aware linting (`project` or `projectService` in parser options), which is the heaviest typescript-eslint configuration mode. Requiring it would exclude users who run typescript-eslint without type-aware linting.
- `get-tsconfig` is a focused library (~5KB) that handles `extends` chains, config resolution, and path matching. It's already a transitive dependency via `tsx` and `knip`.
- `get-tsconfig` works identically regardless of which parser is configured, removing a class of "works in my editor but not in CI" issues.
- The failure mode is clearer: if no tsconfig is found, we know immediately and can warn. With parser services, the absence is silent.

### Decision 2: Source root derivation priority

**Choice:** Derive the source root in this priority order:

1. `compilerOptions.rootDir` -- explicit, semantic match for "root of source files"
2. Inferred from the first `paths` target prefix -- e.g., `"@/*": ["src/*"]` implies source root is `src`
3. `compilerOptions.baseUrl` if it is not `.` or the project root -- e.g., `baseUrl: "src"` implies source root is `src`
4. Fall back to no source root (file-relative path is used directly for module matching)

**Rationale:**

- `rootDir` is the most semantically precise option: TypeScript defines it as "the root directory of input files."
- Many projects don't set `rootDir` explicitly but do have `paths` that reveal the source root.
- `baseUrl` is the weakest signal since it's commonly `.` (project root), which is not useful as a source root. Only a non-trivial `baseUrl` is informative.
- Step 4 avoids hard failure. Module matching without a source root uses the file path relative to the project root. This is usable for flat-layout projects where source files live at the project root.

### Decision 3: Project root = `dirname(tsconfig.json)`

**Choice:** The project root is always the directory containing the resolved `tsconfig.json`.

**Alternative considered:** Keep the current approach of scanning the absolute path for `/<sourceRoot>/` and taking the prefix.

**Rationale:**

- The tsconfig location is a well-defined, unambiguous project root marker.
- In monorepos, `get-tsconfig` walks upward from each file to find the nearest tsconfig, so each package naturally gets its own project root.
- The current string-search approach breaks if the `sourceRoot` segment appears in a parent directory name (e.g., `/home/src/my-project/src/utils.ts` would match the wrong `/src/`).

### Decision 4: Alias resolution via `createPathsMatcher`

**Choice:** Use `get-tsconfig`'s `createPathsMatcher()` for alias resolution. It returns a function `(specifier: string) => string[]`. We take the first element of the returned array (first candidate wins).

**Alternative considered:** Parse `compilerOptions.paths` ourselves and implement matching logic.

**Rationale:**

- `createPathsMatcher` already handles `baseUrl` resolution, prefix matching, exact matching, and wildcard substitution. Its implementation mirrors TypeScript's own `moduleNameResolver.ts`.
- Using it avoids reimplementing path pattern matching and keeps behavior consistent with TypeScript's resolution.
- Taking only the first result aligns with our non-goal of not supporting multiple candidates.
- `createPathsMatcher` returns `null` when no `paths` are configured, which we handle as "no aliases available."

### Decision 5: What counts as a local (alias) specifier

**Choice:** A specifier is local if:

- It starts with `.` (relative import), OR
- `createPathsMatcher` returns a non-empty result for it

**Alternative considered:** Keep a hardcoded list of known alias prefixes.

**Rationale:**

- This is the key change from the current `isLocalSpecifier` which only checks `.` and `@/`. By deferring to the paths matcher, any alias the project configures is automatically recognized.
- External package specifiers like `react` or `@typescript-eslint/parser` will simply return no match from `createPathsMatcher` (they're not in `paths`), so they're correctly treated as external.
- This handles scoped packages correctly: `@my-org/package` is external (no paths match), while `@/utils` is local (paths match to `src/utils`).

### Decision 6: New utility module location and API

**Choice:** Create `src/utils/tsconfig-resolution.ts` exporting:

- `getTsconfigInfo(filename: string): TsconfigInfo | undefined` -- finds and caches tsconfig for a file
- `resolvePathAlias(specifier: string, info: TsconfigInfo): string | undefined` -- resolves an alias to an absolute path
- `TsconfigInfo` interface: `{ projectRoot: string, sourceRoot: string | undefined, pathsMatcher: ((specifier: string) => string[]) | null }`

**Rationale:**

- Follows the existing pattern: utilities in `src/utils/`, exported through `src/utils/index.ts`.
- The `TsconfigInfo` structure is computed once per tsconfig and reused across all rules evaluating files under that tsconfig.
- `resolvePathAlias` wraps `createPathsMatcher` plus `resolveExistingFile` (the extension probing logic), keeping the two concerns together.

### Decision 7: Caching strategy

**Choice:** Module-level `Map<string, TsconfigInfo | null>` keyed by resolved tsconfig path. `getTsconfig()` from `get-tsconfig` itself accepts a `Cache` parameter for its own internal caching. We layer our cache on top for the derived `TsconfigInfo`.

**Rationale:**

- ESLint processes files sequentially within a single run. A module-level cache is sufficient and cleared naturally when the process exits.
- Most projects have 1 tsconfig, monorepos have a handful. The cache stays tiny.
- No need for cache invalidation within a lint run -- tsconfig files don't change mid-lint.

### Decision 8: Signature changes to `resolveImportTarget` and `readArchitecturePolicy`

**Choice:**

- `readArchitecturePolicy(context)` no longer reads `sourceRoot` from settings. Instead, it receives tsconfig info and uses `tsconfigInfo.sourceRoot`.
- `resolveImportTarget(importerFile, tsconfigInfo, specifier)` replaces the `sourceRoot` parameter with `TsconfigInfo`. Alias resolution delegates to `resolvePathAlias` instead of the hardcoded `@/` logic.
- `matchFileToArchitectureModule(filePath, policy)` uses `tsconfigInfo.projectRoot` + `tsconfigInfo.sourceRoot` for path stripping instead of string-searching for `/<sourceRoot>/`.
- `ArchitecturePolicy` type drops `sourceRoot?: string` and gains `tsconfigInfo: TsconfigInfo`.
- `isLocalSpecifier` changes to accept `pathsMatcher` and uses it to determine if a specifier is local.

**Rationale:**

- These are the minimal signature changes needed to thread tsconfig info through the existing call sites.
- Each rule already calls `readArchitecturePolicy(context)` early. Adding `getTsconfigInfo(context.filename)` in the same location keeps the change localized.
- `no-false-sharing` already extracts `sourceRoot` and `projectRoot` from the policy; it will extract them from `tsconfigInfo` instead.

## Risks / Trade-offs

**[Risk] Projects without `tsconfig.json` lose architecture rules entirely.**
Mitigation: Emit a clear console warning when no tsconfig is found, explaining that architecture rules require a tsconfig.json. This is an acceptable trade-off since the plugin targets TypeScript projects. Document the requirement in README.

**[Risk] `rootDir` is absent and `paths` don't reveal source root.**
Mitigation: Fall back to no source root (step 4 in Decision 2). Module matching uses file paths relative to the project root. This works for flat-layout projects. For projects where this produces wrong module matches, the fix is adding `rootDir` to tsconfig -- a reasonable ask.

**[Risk] `get-tsconfig` becomes unmaintained.**
Mitigation: The library is small, well-scoped, and maintained by the `tsx` author. It has wide adoption. If it stalls, the API surface we use (`getTsconfig`, `createPathsMatcher`) is small enough to inline.

**[Risk] `createPathsMatcher` resolves multiple candidates but we take only the first.**
Mitigation: Multiple candidates are rare in practice (requires something like `"@/*": ["src/*", "generated/*"]`). Taking the first matches TypeScript's own behavior when the first candidate resolves successfully.

**[Trade-off] Breaking change for existing users.**
Users must remove `sourceRoot` from settings and ensure their tsconfig has `rootDir` or `paths`. This is a major version bump. The migration is straightforward: if you had `sourceRoot: 'src'`, add `rootDir: "./src"` to tsconfig (most projects already have this).

**[Trade-off] New runtime dependency.**
`get-tsconfig` is small and focused, but it's a new dependency in the install tree. Since eslint-plugin-unslop is always a devDependency, the blast radius of any supply-chain issue is limited to development environments.
