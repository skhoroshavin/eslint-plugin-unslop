## Why

Tests that live inside a module folder can currently import private sibling files directly, which makes it easy to write white-box tests against implementation details instead of the module's public entrypoint. This weakens refactor safety and is a gap in the current architecture enforcement, which already covers cross-module imports through `unslop/import-control`.

## What Changes

- Add a new ESLint rule, `unslop/no-whitebox-testing`, that checks test-file imports within a module folder.
- Report same-folder test imports that target private sibling files when the import could instead go through the current module's configured public entrypoint.
- Allow same-folder test imports that resolve to the current module entrypoint, including configured architecture `entrypoints` and default `index.ts` behavior.
- Leave cross-module imports and child-submodule imports to existing `unslop/import-control` behavior rather than duplicating those checks in the new rule.
- Add end-to-end rule tests that cover allowed entrypoint imports and denied same-module private imports.

## Capabilities

### New Capabilities

- `no-whitebox-testing`: Prevent test files from importing private implementation files from their own module and require using the module's public entrypoint instead.

### Modified Capabilities

- None.

## Impact

- Affected code: new rule implementation under `src/rules/no-whitebox-testing/`, rule registration in `src/rules/index.ts`, and user-facing plugin exports/config wiring if the rule is exposed in shipped configs.
- Affected behavior: test files gain a new architecture-oriented lint check for same-module imports only; `unslop/import-control` remains responsible for cross-module and child-module boundaries.
- Dependencies and systems: reuses existing TypeScript/architecture resolution patterns, especially module `entrypoints` handling from the current architecture policy.

## Non-goals

- Changing `unslop/import-control` semantics for cross-module imports.
- Restricting imports into child submodules from tests when those imports are already handled by architecture policy.
- Introducing new architecture configuration fields beyond the existing `entrypoints` support.
