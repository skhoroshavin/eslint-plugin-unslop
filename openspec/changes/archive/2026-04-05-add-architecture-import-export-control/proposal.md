## Why

Architecture policy in user projects is often maintained outside `eslint-plugin-unslop` (for example via dependency-cruiser), which leads to verbose config and split ownership between multiple systems. This change brings architecture boundaries and symbol-level export governance into a single ESLint plugin policy model.

## What Changes

- Add a shared architecture policy configuration under ESLint settings (`settings.unslop.architecture`) as a single source of truth for boundary and API surface constraints.
- Add `unslop/import-control` to enforce deny-by-default module dependency direction using concise per-module `imports` allowlists.
- Add `unslop/import-control` constraints that permit cross-module imports only through public entrypoints (`index.ts` or `types.ts`) and absorb deep-import checks currently handled separately.
- Add `unslop/export-control` to enforce optional export constraints for selected modules using `exports` symbol regex allowlists on imports from public entrypoints.
- Set unmatched architecture modules to fail closed (imports denied) rather than being ignored.
- Keep export policy permissive by default: modules without `exports` rules allow all symbol imports.
- Integrate architecture enforcement in the plugin workflow so architecture policy can be managed with existing ESLint tooling instead of split between separate systems.

## Non-goals

- Replacing all existing rules in this change; current rules continue to work unless explicitly migrated.
- Enforcing symbol-level export control for every module by default.
- Implementing advanced runtime-only analysis (for example, non-literal dynamic import targets).
- Redesigning unrelated linting behavior outside architecture boundaries and export control.

## Capabilities

### New Capabilities

- `architecture-import-export-control`: Define and enforce repository architecture boundaries and optional symbol-level export contracts through ESLint plugin rules with a shared policy config.

### Modified Capabilities

- `rule-module-boundaries`: Expand architecture boundary requirements to support plugin-native policy definition and enforcement via shared ESLint settings.

## Impact

- Affected code: new rule modules under `src/rules/` for import and export control, shared architecture config parsing/matching utilities, plugin exports/config wiring, and rule tests.
- Affected configuration: repository ESLint flat config gains/expands `settings.unslop.architecture` as policy source.
- Affected scripts/tooling: architecture validation for this capability is handled through ESLint rule execution and shared plugin configuration.
- Developer impact: architecture policy becomes shorter, colocated with existing unslop rules, and extensible to export governance not covered by dependency-cruiser alone.
