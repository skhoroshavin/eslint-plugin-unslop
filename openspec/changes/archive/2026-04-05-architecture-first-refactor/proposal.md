## Why

The plugin's primary value is architecture enforcement, but its configuration story treats that as secondary — `no-false-sharing` uses its own rule options instead of the shared architecture settings, and the `recommended` config only covers symbol fixers. This creates config duplication and undersells the architecture features to new users.

## What Changes

- **BREAKING**: `unslop/no-false-sharing` drops its rule-level `options` schema entirely; shared directories are now declared via `shared: true` on module policies in `settings.unslop.architecture`
- **BREAKING**: `file` mode is removed from `no-false-sharing`; consumer counting always uses directory mode
- `unslop/no-false-sharing` reads `readArchitecturePolicy()` from settings, filters modules where `shared: true`, and derives project root via the existing `sourceRoot` path derivation (consistent with import/export-control)
- Rename `configs.recommended` → `configs.minimal` (zero-config symbol fixers only)
- Add `configs.full` (architecture enforcement suite: import-control + export-control + no-false-sharing, requires `settings.unslop.architecture`)
- README rewritten: architecture enforcement as primary narrative, symbol fixers as secondary zero-config bonus

## Capabilities

### New Capabilities

- `plugin-configs`: The plugin's shareable configs — their names, contents, and what each enables. Currently there is no spec for this; the configs are implicit in `src/index.ts`.

### Modified Capabilities

- `architecture-import-export-control`: `no-false-sharing` now reads from the same architecture settings as import/export-control; `shared: true` on a module policy activates false-sharing enforcement for that module's files
- `rule-module-boundaries`: The repository's own lint config must be updated to use `shared: true` in architecture settings instead of `no-false-sharing` rule options; the self-linting scenario changes accordingly

## Impact

- `src/rules/no-false-sharing/index.ts`: schema drops to `[]`, `create()` switches from reading `options[0]` to `readArchitecturePolicy()`
- `src/rules/no-false-sharing/index.test.ts`: all test cases rewritten to use `settings` instead of rule `options`
- `src/index.ts`: `recommended` renamed to `minimal`; `full` config added
- `eslint.config.mjs`: `no-false-sharing` rule options replaced with `shared: true` on relevant architecture modules
- `README.md`: full rewrite of framing, quick start, and rule documentation order
