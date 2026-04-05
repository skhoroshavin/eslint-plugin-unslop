## Context

The proposal redefines `unslop/no-false-sharing` around one canonical behavior: evaluate whether publicly exported symbols from shared-module entrypoints are truly shared. The current implementation appears to miss alias imports (`@/...`) and reports at file level, which is less actionable in barrel-based architectures.

This change is cross-cutting across `no-false-sharing`, `import-control`, `export-control`, and shared path/import utilities. It must preserve deterministic linting, avoid parser-services requirements, and keep performance acceptable for repo-wide importer scans.

## Goals / Non-Goals

**Goals:**

- Resolve local project imports consistently (relative and alias forms) so symbol consumer counts are accurate.
- Analyze false sharing at entrypoint-exported symbol granularity and report failing symbol names.
- Include consumer context in diagnostics: consumer count and the single consumer group when only one exists.
- Count `import type { ... }` usage as real symbol consumers so shared type APIs are evaluated.
- Forbid local cross-module namespace imports (`import * as ...`) in `import-control` while keeping external namespace imports allowed.
- Forbid `export *` on local shared-module entrypoints in `export-control` so symbol provenance remains explicit.

**Non-Goals:**

- Introducing optional modes or alternate runtime behaviors for `no-false-sharing`.
- Performing full transitive program-level dataflow using TypeScript type information.
- Enforcing namespace-import restrictions for external dependencies in this change.

## Decisions

1. Canonical symbol-level target set comes from shared module entrypoints.
   - Decision: evaluate only symbols exported from `index.ts`/`types.ts` for modules marked `shared: true`.
   - Rationale: this matches public API boundaries and avoids noisy internal-file policing.
   - Alternative rejected: file/leaf analysis mode, because it adds behavior surface and conflicts with desired single model.

2. Consumer discovery uses unified local import resolution.
   - Decision: normalize import specifiers to source-root-relative targets for both relative and alias forms (`@/...`, explicit `index`, extension variants).
   - Rationale: this closes the alias gap and aligns architecture-rule path semantics.
   - Alternative rejected: ad-hoc alias matching in one rule, because it risks drift and false negatives.

3. Symbol usage counting prefers explicit symbol attribution.
   - Decision: count consumers from named imports/re-exports that reference an entrypoint-exported symbol; aggregate by existing consumer-group strategy used by the rule.
   - Rationale: produces precise symbol diagnostics and preserves current grouping expectations.
   - Alternative rejected: blanket module-level counting for all imported symbols, because it overstates sharing and defeats symbol-level intent.

4. Diagnostics report relocation hints without adding new configuration.
   - Decision: when a symbol fails sharing checks, message includes symbol name and either: no consumers, one consumer group, or insufficient distinct consumers.
   - Rationale: developers can quickly move ownership toward the identified consumer area.
   - Alternative rejected: separate report metadata channels, because ESLint messaging already supports actionable text.

5. `import-control` forbids local cross-module namespace imports.
   - Decision: reject `import * as X from '<local module>'` for project-local cross-module edges; allow namespace imports from external packages.
   - Rationale: namespace imports block symbol-level ownership analysis for local architecture boundaries.
   - Alternative rejected: configurable policy flag, because requested direction is a single default behavior.

6. `export-control` enforces explicit re-exports on shared entrypoints.
   - Decision: reject `export * from ...` for local shared-module entrypoints that participate in symbol-level false-sharing analysis.
   - Rationale: unresolved provenance from export-all prevents reliable symbol ownership and consumer counting.
   - Alternative rejected: attempting best-effort symbol inference through export-all chains, because ambiguity leads to inconsistent diagnostics.

7. Type-only imports count as consumers.
   - Decision: treat `import type { Foo }` and type-only re-export usage as symbol consumption for false-sharing purposes.
   - Rationale: shared type contracts are part of module public API and must be measured consistently with value symbols.
   - Alternative rejected: ignore type-only usage, because it undercounts real shared contracts and biases toward false positives.

## Risks / Trade-offs

- [Namespace import ban may surface many existing violations] -> Add focused test coverage and clear message text; teams can migrate to named imports incrementally.
- [Symbol attribution may miss complex re-export patterns] -> Enforce no `export *` on shared entrypoints and prioritize explicit named import/export patterns.
- [Alias normalization regressions across path forms] -> Reuse shared resolver helpers and add fixtures for `@/...`, `/index`, and extension variants.
- [Performance overhead from symbol consumer scans] -> Short-circuit once threshold is met and scope scans to local project imports only.

## Migration Plan

1. Land spec changes describing symbol-level false-sharing requirements, local namespace-import restriction, and shared-entrypoint `export *` prohibition.
2. Implement resolver normalization updates and symbol-attribution logic in `no-false-sharing`.
3. Implement `import-control` namespace import restriction for local cross-module imports.
4. Implement or tighten `export-control` rejection for `export *` on shared entrypoints.
5. Add RuleTester scenarios for alias imports, symbol-level diagnostics, type-only consumers, namespace-import behavior, and `export *` rejection.
6. Roll out with updated docs/examples showing expected diagnostics and migration pattern to explicit named imports/exports.

Rollback strategy: if unexpected breakage appears, revert coordinated behavior changes in `no-false-sharing`, `import-control`, and `export-control` together to restore previous architecture checks.
