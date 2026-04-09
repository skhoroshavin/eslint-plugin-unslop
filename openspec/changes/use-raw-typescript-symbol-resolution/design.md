## Context

The current architecture stack combines three different resolution models:

- ESLint ESTree visitors for the linted file
- `get-tsconfig`-based project and alias discovery in `src/utils/tsconfig-resolution.ts`
- regex-based source scanning in `src/rules/no-false-sharing/index.ts` for project-wide consumer discovery

That split keeps the rules lightweight, but it also duplicates TypeScript behavior in plugin code. `import-control` relies on custom file probing instead of the compiler's module resolver, and `no-false-sharing` reduces imports to text-matched names even when the real question is whether two import sites resolve to the same exported symbol through aliases and re-export chains.

This change moves architecture analysis onto a single semantic model: a cached TypeScript project per tsconfig. The rules still enforce the same architecture policy and the same directory-based consumer grouping, but they use the compiler as the source of truth for project layout, module resolution, and symbol identity. When a semantic project cannot be created, architecture rules fail open and report nothing for that file.

## Goals / Non-Goals

**Goals:**

- Replace custom architecture-rule module resolution with TypeScript's compiler API.
- Introduce a shared project-analysis layer that caches project state per tsconfig and is reusable across architecture rules.
- Resolve `no-false-sharing` consumers by canonical symbol identity instead of raw import text.
- Preserve current architectural semantics where they are policy decisions rather than resolution artifacts:
  - shared entrypoints are still `index.ts` and `types.ts`
  - consumer grouping stays directory-based
  - external deep imports of internal files still do not count toward sharing
- Keep failure behavior predictable: when project creation or semantic lookup fails, architecture rules explicitly fail instead of partially approximating results.

**Non-Goals:**

- Rewriting non-architecture rules to use TypeScript semantic analysis.
- Expanding `export-control` from syntax-driven export-contract checks into full semantic export-graph validation.
- Adding `ts-morph` or making typescript-eslint parser services the primary project model.
- Enforcing a hard failure when tsconfig discovery or semantic project creation fails.

## Decisions

### Decision 1: Use raw TypeScript compiler APIs as the primary analysis engine

**Choice:** Build architecture analysis on `typescript` directly, using compiler APIs such as config parsing, `Program`, `TypeChecker`, and TypeScript module resolution.

**Alternatives considered:**

- Keep `get-tsconfig` plus handwritten probing and regex scanning.
- Use typescript-eslint parser services as the primary semantic source.
- Use `ts-morph` as the project abstraction layer.

**Rationale:**

- The compiler API is the real source of truth for module and symbol resolution, so it removes the largest "not invented here" seams in the current design.
- Parser services describe the currently linted file well, but `no-false-sharing` needs project-wide analysis across many files, so a rule-owned project cache is a better fit.
- `ts-morph` would improve ergonomics, but it adds another abstraction layer and dependency to an ESLint plugin that already needs to interoperate cleanly with ESLint and TypeScript directly.
- Using raw TypeScript keeps the implementation aligned with the fail-open requirement: the plugin can catch semantic setup failures at explicit boundaries and skip architecture analysis cleanly.

### Decision 2: Introduce a cached `ProjectContext` keyed by resolved tsconfig path

**Choice:** Create a shared utility layer under `src/utils/` that discovers the nearest `tsconfig.json`, parses it through TypeScript, and caches a `ProjectContext` per resolved config path. The cache owns `Program` creation for architecture rules and does not reuse typescript-eslint parser-services programs in the initial implementation.

The cached context should contain:

- resolved tsconfig path
- project root (`dirname(tsconfig.json)`)
- parsed compiler options / parsed command line
- source root derived from compiler options
- `Program`
- `TypeChecker`
- any module-resolution helpers/cache needed by rules

**Alternatives considered:**

- Recreate a TypeScript program inside each rule invocation.
- Cache only compiler options and rebuild the program repeatedly.
- Reuse parser-services `program` opportunistically when one is available.

**Rationale:**

- Architecture rules can run many times in one lint process; rebuilding project state per file would be unnecessarily expensive.
- The repo already uses module-level caching for tsconfig-derived state, so a project-context cache extends an established pattern.
- A shared project facade lets rule code stay small and policy-focused instead of filling each rule with compiler plumbing.
- Always going through the same cache avoids split behavior where architecture rules sometimes reason over ESLint-managed semantic state and sometimes over their own TypeScript project.

### Decision 3: Use TypeScript config parsing and module resolution, but preserve current architecture-policy semantics

**Choice:** Replace `get-tsconfig` path matching and manual extension probing with TypeScript-backed config parsing and module resolution for architecture rules, while keeping current policy semantics intact. The first implementation fully removes `get-tsconfig`; nearest-config discovery and parsing move to TypeScript APIs in the same change.

This means:

- nearest `tsconfig.json` discovery remains per linted file
- project root remains the directory containing the resolved tsconfig
- source root is still derived from compiler options for architecture-module matching
- local-vs-external import classification follows TypeScript module resolution instead of a custom alias matcher
- `import-control` still decides validity using the existing architecture policy and entrypoint rules

**Alternatives considered:**

- Keep `get-tsconfig` temporarily for nearest-config discovery while only switching semantic analysis onto raw TypeScript.
- Replace all architecture semantics with TypeScript concepts such as project references or package boundaries.

**Rationale:**

- The goal is to replace custom resolution logic, not to redefine what the rules mean.
- Keeping module policy semantics stable limits scope and keeps existing rule behavior recognizable.
- TypeScript-native module resolution improves correctness for aliases, extensions, and package export rules without changing the architecture contract itself.
- Removing `get-tsconfig` in the same change keeps the resolution stack conceptually single-source: TypeScript owns config discovery, project creation, module resolution, and symbol resolution.

### Decision 4: Canonicalize `no-false-sharing` by exported symbol identity, not by imported name strings

**Choice:** `no-false-sharing` should gather shared entrypoint exports and consumer imports through the TypeScript checker, normalize aliased symbols to their canonical declaration identity, and compare consumers against that canonical export set.

The rule should model each exported symbol with enough metadata to support the existing semantics:

- exported name from the shared entrypoint
- canonical symbol identity
- declaring file for that symbol
- whether the public export is backed by the entrypoint itself or an internal file

Consumer discovery should then count:

- public consumers importing the canonical symbol through the shared entrypoint
- internal consumers in the same shared module importing the same canonical symbol through the entrypoint or the backing file

It should continue to ignore cross-module deep imports of backing files as evidence of sharing.

**Alternatives considered:**

- Keep the current exported-symbol descriptor and only improve import parsing from regex to AST.
- Compare imports by resolved file plus imported name string.

**Rationale:**

- Re-export chains and aliased bindings are exactly where file-plus-name matching breaks down.
- Canonical symbol identity directly answers the rule's real question: whether two usage sites refer to the same publicly exported thing.
- Keeping the current consumer grouping policy on top of canonical symbols limits the change to resolution precision, not policy semantics.

### Decision 5: Keep `import-control` syntax-driven, but move its target resolution onto TypeScript

**Choice:** `import-control` should continue to inspect import/export declarations from ESTree, but its notion of the target file should come from the shared `ProjectContext` instead of `resolveImportTarget`.

**Alternatives considered:**

- Rebuild `import-control` as a symbol-aware rule.
- Leave `import-control` on the current path-probing utility while only `no-false-sharing` becomes semantic.

**Rationale:**

- The rule's decisions are about allowed module edges and public entrypoints, not about symbol ownership.
- Moving only target resolution onto TypeScript gives most of the precision benefit with minimal conceptual churn.
- This avoids forcing every architecture rule into full checker-driven analysis when module identity is enough.

### Decision 6: Architecture rules fail open on semantic-project failures

**Choice:** If tsconfig discovery, config parsing, program creation, source-file lookup, or other semantic prerequisites fail for the current linted file, architecture rules return no reports for that file.

Expected failure modes include:

- no reachable `tsconfig.json`
- invalid or unsupported tsconfig state
- file not present in the semantic project
- TypeScript module resolution returning no local target for a specifier

**Alternatives considered:**

- Report configuration diagnostics into the lint output.
- Throw rule errors or hard-fail verification.
- Fall back to the current regex/probing behavior when semantic setup fails.

**Rationale:**

- The user explicitly prefers fail-open behavior over partial approximation or hard failure.
- Falling back to old heuristics would reintroduce the exact split-brain behavior this change is trying to remove.
- The plugin already treats missing tsconfig as a non-fatal condition for architecture rules; this extends that principle to semantic setup more broadly.

## Risks / Trade-offs

- **[Risk] Semantic project creation is materially heavier than tsconfig parsing alone.** -> Mitigation: cache one `ProjectContext` per tsconfig path and keep semantic analysis limited to architecture rules.
- **[Risk] Some linted files may sit outside the tsconfig's included file set and therefore lose architecture validation silently.** -> Mitigation: define this as fail-open behavior in specs and tests so the no-op is intentional and documented rather than accidental.
- **[Risk] Canonical symbol analysis may blur distinctions between type-only and value exports if implemented too coarsely.** -> Mitigation: keep explicit metadata for type-only imports/exports and cover re-exported type symbols in rule tests.
- **[Risk] Replacing the current resolution stack may change edge-case behavior for alias and extension handling.** -> Mitigation: capture those cases in modified specs and compare new rule behavior against existing architecture scenarios.
- **[Risk] Direct compiler-API usage can make rule code harder to read.** -> Mitigation: isolate TypeScript interactions behind small shared utilities so rule files continue to express policy, not compiler plumbing.

## Migration Plan

1. Add the shared TypeScript project utility layer and switch architecture-policy reading to use it for project root and source-root derivation.
2. Move `import-control` from `resolveImportTarget` to TypeScript-backed target resolution while preserving existing policy checks and diagnostics.
3. Replace `no-false-sharing` importer scanning with checker-driven export/import analysis based on canonical symbols.
4. Update architecture rule tests and specs for semantic-project fail-open behavior, TypeScript-backed module resolution, and symbol-aware false-sharing analysis.
5. Remove now-obsolete custom resolution helpers once architecture rules no longer depend on them.

Rollback strategy: restore the previous tsconfig-resolution and import-scanning utilities if semantic project creation causes unacceptable lint performance or breaks architecture analysis in common setups.

## Open Questions

- None for the initial implementation. Architecture rules will use their own tsconfig-keyed `ProjectContext` cache, and tsconfig discovery will move fully to TypeScript config APIs in the first implementation.
