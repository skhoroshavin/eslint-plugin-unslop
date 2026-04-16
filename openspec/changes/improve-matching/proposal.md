## Why

The current architecture matcher mixes file-path matching with module-path matching, which makes the config more verbose than it should be and produces surprising cases such as repeated `models` plus `models/*` allowlists. This is a good time to make selector semantics explicit, fix contradictory edge cases, and define a single matching model that all architecture-aware rules can share.

## What Changes

- Add a shared architecture configuration model based on canonical module paths instead of raw file paths.
- Define selector semantics for exact module selectors (`foo`), direct-child selectors (`foo/*`), and family selectors (`foo/+`) where `foo/+` means `foo` or `foo/<one-segment>`.
- Define selector precedence so more concrete matches win: exact `>` direct child `*` `>` family `+`.
- Update import allowlist matching to use the same selector language and depth rules as architecture keys.
- Move architecture key and selector semantics into a dedicated architecture capability instead of leaving them distributed across rule-specific specs.
- Fix the current wildcard edge case so `foo/*` no longer matches the parent module's entrypoint file.
- **BREAKING** Remove support for file-shaped architecture keys such as `index.ts` or `rules/public.ts`; architecture selectors become directory-shaped module selectors only.

## Non-goals

- Adding recursive descendant selectors; this change only covers exact modules, one-level child modules, and their combined `+` form.
- Introducing policy inheritance or merge semantics across overlapping selectors beyond the normal winner-takes-most-concrete rule.
- Refactoring unrelated architecture rules or changing export/shared-symbol policy outside the matcher behavior they already consume.

## Capabilities

### New Capabilities

- `architecture-config`: Define shared canonical module resolution and selector matching for `settings.unslop.architecture`, including exact, `*`, and `+` selectors, precedence rules, and directory-shaped module selectors.

### Modified Capabilities

- `import-control`: Remove duplicated architecture key-matching requirements from this rule spec and update import allowlist requirements to use the shared selector semantics defined by `architecture-config`.
- `no-whitebox-testing`: Remove duplicated architecture configuration details from this rule spec and reference shared module/entrypoint semantics from `architecture-config`.
- `no-false-sharing`: Remove duplicated architecture configuration details from this rule spec and reference shared module ownership and policy semantics from `architecture-config`.
- `plugin-configs`: Update config requirements so architecture-aware config behavior references `architecture-config` instead of restating shared architecture semantics.

## Impact

- Affects shared architecture matching utilities, especially `src/utils/architecture-policy.ts`, plus architecture-aware rules that consume those utilities.
- Changes `unslop/import-control` behavior and tests, including wildcard matching, precedence, and anonymous/default module handling.
- Requires spec cleanup so shared architecture-key behavior lives under `architecture-config` and rule specs reference it instead of redefining it.
- Requires spec and documentation updates for architecture config examples, including dogfooded configs that currently repeat both `models` and `models/*`.
- Introduces a configuration breaking change for any project currently using file-shaped architecture keys.
