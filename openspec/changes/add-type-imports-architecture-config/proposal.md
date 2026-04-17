## Why

`unslop/import-control` currently applies the same `imports` allowlist to both value imports and type-only imports, which makes architecture policies stricter than needed for modules that only depend on another module's types. Adding a dedicated `typeImports` field lets teams keep runtime boundaries unchanged while allowing narrower, explicit exceptions for type-only dependencies.

## What Changes

- Add an optional `typeImports` field to shared `settings.unslop.architecture` module policies.
- Keep value import enforcement unchanged: `unslop/import-control` continues to allow cross-module value imports only when the target matches `imports`.
- Allow type-only imports when the target matches either `imports` or `typeImports`.
- Preserve current deny-by-default behavior when `typeImports` is omitted.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `architecture-config`: Extend shared module policy semantics to accept an optional `typeImports` allowlist alongside `imports`, `exports`, `shared`, and `entrypoints`.
- `import-control`: Change boundary enforcement so type-only imports use the union of `imports` and `typeImports`, while value imports continue to use only `imports`.

## Non-goals

- Changing how `exports`, `entrypoints`, or `shared` behave.
- Relaxing runtime import boundaries for normal imports.
- Refactoring unrelated architecture-policy parsing or import matching behavior.

## Impact

- Affects `src/utils/architecture-policy.ts` and related shared architecture policy types/parsing.
- Affects `src/rules/import-control/` behavior and end-to-end RuleTester coverage.
- Requires spec updates for `architecture-config` and `import-control` to document the new configuration field and type-only import semantics.
