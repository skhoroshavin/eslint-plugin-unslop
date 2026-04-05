## Why

`unslop/import-control` enforces same-module depth limits for `./` imports, but the same deep paths can be reached through source-root aliases (for example `@/...`) without triggering the same check. This creates an easy bypass in alias-first TypeScript codebases and weakens module-internal boundary hygiene.

## What Changes

- Update `unslop/import-control` requirements so same-module depth limits apply to local imports based on resolved target identity, not import string style.
- Treat source-root alias self-imports and `./` self-imports consistently when both resolve to the same module instance.
- Preserve existing cross-module behavior: alias imports to another module's `index.ts` or `types.ts` remain allowed when dependency policy permits.
- Add scenarios that cover same-module deep alias rejection and cross-module public-entrypoint alias allowance.

## Non-goals

- Changing architecture policy syntax (`settings.unslop.architecture`) or introducing new configuration options.
- Broadly tightening or relaxing cross-module import policy beyond the alias self-import depth parity described here.
- Refactoring unrelated rule internals or test infrastructure.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `architecture-import-export-control`: Strengthen `unslop/import-control` same-module depth requirements so deep alias self-imports are rejected the same way as deep relative self-imports.

## Impact

- Affected specs: `openspec/specs/architecture-import-export-control/spec.md`.
- Affected implementation: `src/rules/import-control/` rule resolution and same-module depth checks.
- Affected tests: `src/rules/import-control/*.test.ts` scenarios for alias and relative same-module imports.
- No public API, package, or dependency changes expected.
