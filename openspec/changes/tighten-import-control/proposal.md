## Why

`unslop/import-control` currently hardcodes `index.ts` and `types.ts` as cross-module public entrypoints, which prevents teams from expressing module-specific public surfaces. We need architecture-driven entrypoint definitions so boundary enforcement matches real module contracts while preserving safe defaults.

## What Changes

- Extend `settings.unslop.architecture` module config with a new `entrypoints` field (`string[]`) for per-module allowed cross-module targets.
- Default `entrypoints` to `['index.ts']` when omitted on a defined module.
- Update `unslop/import-control` cross-module entrypoint checks to use configured `entrypoints` instead of hardcoded `index.ts`/`types.ts`.
- Keep anonymous/unmatched modules deny-by-default for imports policy, but allow cross-module entrypoint access only to `index.ts` when no module policy exists.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `architecture-import-export-control`: Change import-control boundary requirements so module entrypoints are configuration-driven via `entrypoints`, with explicit defaulting behavior for configured and anonymous modules.

## Non-goals

- Changing how `imports`, `exports`, or `shared` policies are declared.
- Expanding entrypoint behavior to non-TypeScript files or introducing glob-based entrypoint matching.
- Refactoring unrelated import-control diagnostics or message wording.

## Impact

- Affected specs: `openspec/specs/architecture-import-export-control/spec.md` (delta required).
- Affected implementation: architecture config parsing and `src/rules/import-control` entrypoint resolution logic.
- Affected tests: import-control scenarios covering explicit entrypoints, default entrypoints, and unmatched-module fallback behavior.
- No new runtime dependencies; plugin settings shape is extended in a backward-compatible way via defaults.
