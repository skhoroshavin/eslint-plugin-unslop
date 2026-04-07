## Why

The architecture rules currently duplicate low-level project analysis in two places: `ArchitecturePolicyResolver` hand-resolves local imports, while `no-false-sharing` separately crawls the filesystem and parses imports with regexes. That duplication makes the implementation brittle, hard to evolve, and increasingly costly now that path resolution should follow `tsconfig` when project configuration is available.

## What Changes

- Introduce a shared TypeScript-backed project analysis layer for local module resolution and source-file import facts used by architecture-aware rules.
- Refactor `unslop/import-control` and `unslop/no-false-sharing` to consume the shared analysis layer instead of maintaining separate custom resolution and scanning pipelines.
- Keep architecture policy parsing, module matching, entrypoint checks, diagnostics, and existing rule behavior unchanged.
- Change local alias/path resolution behavior only where project configuration is available: when a `tsconfig` can be used, path resolution follows TypeScript configuration instead of the plugin's built-in `@/` shortcut.

## Capabilities

### New Capabilities

- `project-analysis-core`: Shared project analysis for architecture rules, covering TypeScript-backed local import resolution and reusable source-file dependency facts.

### Modified Capabilities

- `architecture-import-export-control`: Local alias/path resolution changes to use `tsconfig` when project configuration is available, while preserving existing boundary enforcement behavior.

## Impact

- Affected code: `src/utils/architecture-policy.ts`, `src/rules/import-control/index.ts`, `src/rules/no-false-sharing/index.ts`, and new shared analysis utilities under `src/utils/`.
- Affected tests: alias-based architecture rule scenarios will need fixture `tsconfig` coverage where they rely on project path aliases.
- Affected dependencies: TypeScript project analysis becomes a first-class dependency of the architecture rule internals.

## Non-goals

- Changing `import-control`, `export-control`, or `no-false-sharing` semantics beyond the explicit `tsconfig`-driven path resolution update.
- Reworking rule diagnostics, thresholds, or consumer-group logic.
- Opportunistic refactors outside the shared project-analysis boundary.
