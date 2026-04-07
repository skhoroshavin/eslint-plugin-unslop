## Context

`unslop/import-control` and `unslop/no-false-sharing` currently compute local project facts through separate internal mechanisms. `ArchitecturePolicyResolver` mixes architecture policy parsing with path normalization, local import resolution, and `@/` alias handling, while `no-false-sharing` separately walks the source tree and parses imports from raw text. This makes the architecture rules harder to reason about, harder to extend, and vulnerable to divergence when path resolution behavior changes.

This change is intentionally constrained. Existing rule behavior, diagnostics, matcher semantics, entrypoint checks, and false-sharing consumer counting must remain unchanged. The only intended outward behavior change is that local alias/path resolution should use `tsconfig` when project configuration is available, which requires alias-based tests to declare the matching TypeScript configuration.

## Goals / Non-Goals

**Goals:**

- Introduce one shared project-analysis layer that both `import-control` and `no-false-sharing` can use.
- Separate architecture policy concerns from project analysis concerns so path resolution is no longer embedded inside `ArchitecturePolicyResolver`.
- Replace regex-based import scanning in `no-false-sharing` with TypeScript-backed source-file facts while preserving current counting behavior.
- Make path resolution use `tsconfig` when project configuration is available and preserve existing fallback behavior for non-project contexts.

**Non-Goals:**

- Changing `import-control`, `export-control`, or `no-false-sharing` rule semantics beyond the explicit `tsconfig`-driven resolution change.
- Re-defining what counts as a consumer in `no-false-sharing`.
- Reworking architecture matcher syntax, entrypoint naming, or consumer-group derivation.
- Broad repo refactors outside the shared project-analysis boundary.

## Decisions

### 1. Create a shared project-analysis utility focused on facts, not rule policy

The new shared layer will expose reusable project facts needed by architecture-aware rules: source-file discovery, import declarations, imported symbol names, and resolved local targets. Rule-specific meaning such as allowlist checks, same-module depth checks, public entrypoint rules, and consumer-group counting stays in the rules.

Rationale: this removes duplicated plumbing without creating a new policy-heavy abstraction that is harder to test or evolve.

Alternatives considered:

- Keep separate per-rule analyzers: rejected because it preserves the current duplication and divergence risk.
- Move all architecture logic into one central engine: rejected because it would couple unrelated rule decisions and make cleanup harder to scope.

### 2. Split `ArchitecturePolicyResolver` into policy matching and project analysis responsibilities

Architecture policy parsing and matcher selection remain custom to `unslop`, but local module resolution moves behind the shared project-analysis layer. The policy side continues to own `settings.unslop.architecture`, `sourceRoot`, matcher precedence, and public-entrypoint classification.

Rationale: architecture matching is product logic; import resolution and file scanning are infrastructure.

Alternatives considered:

- Leave resolution in `ArchitecturePolicyResolver` and only reuse it from other rules: rejected because it would keep policy and infrastructure entangled.
- Replace the whole resolver with TypeScript-only project APIs: rejected because policy matching and `unslop`-specific defaults would become harder to express cleanly.

### 3. Use TypeScript-backed parsing for local import facts, while preserving current rule semantics

`no-false-sharing` will stop parsing imports with regexes. Instead, the shared analysis layer will read source files through TypeScript-backed parsing and return import facts that are semantically equivalent to the current rule's needs: named imports, type-only imports, and resolved local targets. `no-false-sharing` will continue to count imported symbols, not symbol references, so current tests and rule behavior remain unchanged.

Rationale: the cleanup should eliminate brittle parsing internals without mixing in a semantics change.

Alternatives considered:

- Switch `no-false-sharing` to usage-based or reference-based analysis now: rejected because that changes the rule contract and current tests.
- Keep regex parsing but centralize file walking: rejected because the most brittle part of the implementation would remain.

### 4. Use `ts-morph` as the shared project-analysis substrate, with optional `get-tsconfig`-style discovery if needed

The shared analysis layer will be built on top of `ts-morph` rather than hand-written file parsing or raw TypeScript compiler glue. `ts-morph` provides the needed project, source file, import declaration, and export declaration access in a form that is easier to keep readable and reusable inside this repository. If locating the relevant `tsconfig` for a given file becomes awkward, a small tsconfig discovery helper library such as `get-tsconfig` may be added to keep that concern out of rule code.

Rationale: this change aims to remove custom-invented infrastructure, not replace one bespoke analysis layer with another. `ts-morph` gives a shared model for project-backed source-file facts with less repository-owned plumbing.

Alternatives considered:

- Raw TypeScript compiler API only: rejected for the first cleanup pass because it increases repository-owned glue code and makes the shared layer harder to keep small and readable.
- `eslint-plugin-boundaries` or `dependency-cruiser` as the core runtime engine: rejected because they solve adjacent problems at the wrong level of abstraction for `unslop`'s rule semantics.
- `eslint-import-resolver-typescript` as the main dependency: rejected because it helps with resolution but does not provide the broader shared project-analysis surface needed by both rules.

### 5. Use `tsconfig` as the authority for path resolution when project configuration is available

When a file can be analyzed in project context, local alias and path resolution will follow TypeScript configuration instead of the plugin's built-in `@/` shortcut. For contexts without usable project configuration, the shared analysis layer will preserve the current fallback behavior so non-project cases continue to work.

Rationale: path aliases belong to project configuration, not hidden plugin policy. This makes alias behavior explicit and aligns rule behavior with the host project.

Alternatives considered:

- Always preserve the built-in `@/` shortcut even when `tsconfig` is present: rejected because it keeps undocumented plugin-owned alias behavior.
- Require project configuration for all local resolution: rejected because it would expand the scope beyond the agreed change and break existing non-project cases.

### 6. Define a narrow `ProjectContext` class and keep rule policy outside it

The shared layer should stay close to `ts-morph` and expose only the small set of project operations that multiple rules need. Instead of a higher-level `ProjectAnalysis` facts API, this change will introduce a `ProjectContext` class with focused methods, for example:

```ts
class ProjectContext {
  resolveLocalSpecifier(importerFile: string, specifier: string): string | undefined
  listSourceFiles(sourceDir: string): readonly string[]
  getSourceFile(filePath: string): SourceFile | undefined
  getImportDeclarations(filePath: string): readonly ImportDeclaration[]
}
```

This keeps the shared boundary small and avoids inventing a second AST model on top of `ts-morph`. `import-control` primarily needs local resolution, while `no-false-sharing` needs source files and import declarations that it can interpret according to its existing counting semantics. Allowlist checks, entrypoint rules, same-module depth checks, and consumer-group logic remain outside `ProjectContext`.

Rationale: a thin class with a few methods isolates project setup, caching, and resolution without overloading the shared layer with rule-specific derived facts.

Alternatives considered:

- Expose the raw `ts-morph` project to all rules: rejected because it leaks implementation details and encourages rule-specific one-off queries.
- Build a heavier `ProjectAnalysis` API that returns normalized import facts: rejected because it starts re-inventing a repository-owned analysis model on top of `ts-morph`.
- Use free helper functions instead of a class: rejected because project setup, caching, and file lookup state belong together and are easier to reason about behind a small object boundary.

### 7. Migrate rule consumers incrementally onto `ProjectContext`

The shared context will be introduced first, then adopted by `no-false-sharing` and `import-control` in sequence. `export-control` stays on the policy side because it does not currently need cross-file analysis.

Rationale: incremental adoption reduces regression risk and keeps each step small enough for the repo's lint and complexity guardrails.

Alternatives considered:

- Rewrite all architecture-aware rules in one pass: rejected because it increases regression surface and obscures which move caused a failure.

## Risks / Trade-offs

- [Project analysis and policy boundaries drift back together] → Keep the shared layer fact-oriented and leave allowlist, entrypoint, and consumer-group decisions in rule code.
- [TypeScript-backed analysis changes alias behavior in existing tests] → Update only alias-based fixtures to include matching `tsconfig` configuration and leave other tests untouched.
- [New analysis layer becomes too broad] → Limit the first version to file discovery, local resolution, and import facts required by current rules.
- [`ts-morph` introduces additional dependency and abstraction surface] → Keep it isolated behind `ProjectContext` so future replacement remains possible without rule rewrites.
- [Performance cost from project-aware analysis] → Share cached analysis results across rule invocations where possible and avoid introducing symbol-reference analysis in this change.

## Migration Plan

1. Add `ts-morph` and, if needed, a small tsconfig discovery helper while isolating both behind `ProjectContext`.
2. Introduce the shared project context and move local resolution behind it.
3. Update alias-based architecture test fixtures so project-backed cases declare the `tsconfig` settings they depend on.
4. Migrate `no-false-sharing` from regex/file-walk logic to shared parsed import facts, preserving existing reports and thresholds.
5. Migrate `import-control` to the shared resolution layer, preserving matcher behavior and boundary checks.
6. Remove superseded bespoke scanning and resolution code once rule coverage confirms parity.

Rollback strategy: revert the rule consumers back to the existing bespoke logic and keep the shared analysis utility unused. The change is internal enough that rollback is code-only and does not require data migration.

## Open Questions

- Which project configuration source should be treated as authoritative for temporary test fixtures: nearest `tsconfig.json`, parser project settings, or a small local lookup strategy that preserves current test ergonomics?
- How much caching is needed in the first shared analysis layer to avoid repeated parsing while keeping the implementation small and predictable?
