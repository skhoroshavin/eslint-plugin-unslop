## MODIFIED Requirements

### Requirement: Architecture config SHALL be defined in shared ESLint settings

The plugin SHALL read architecture policy from `settings.unslop.architecture`. Policies are keyed by architecture key selectors and may define `imports`, `typeImports`, `exports`, `shared`, and `entrypoints`. `typeImports` SHALL default to `[]` when omitted. `entrypoints` SHALL default to `['index.ts']` when omitted. Source root SHALL be derived from the discovered `tsconfig.json`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture-aware rules MUST use that shared policy

#### Scenario: Architecture settings are absent

- **WHEN** architecture-aware rules run without `settings.unslop.architecture`
- **THEN** they MUST apply anonymous module defaults to all files

#### Scenario: Configured module omits typeImports

- **WHEN** a module policy omits `typeImports`
- **THEN** allowed type-only imports default to `[]`

#### Scenario: Configured module omits entrypoints

- **WHEN** a module policy omits `entrypoints`
- **THEN** allowed entrypoints MUST default to `['index.ts']`

### Requirement: Architecture config SHALL preserve anonymous modules for unmatched canonical module paths

When no configured architecture key owns a canonical module path, the plugin SHALL treat that path as an anonymous module. Anonymous modules SHALL have empty `imports`, empty `typeImports`, empty `exports`, `shared: false`, and default `entrypoints` of `['index.ts']`.

#### Scenario: Unmatched canonical module path becomes anonymous module

- **WHEN** a file resolves to the canonical module path `unknown/public` and no configured architecture key owns that path
- **THEN** that path is treated as an anonymous module

#### Scenario: Anonymous module uses default policy values

- **WHEN** a file belongs to an anonymous module
- **THEN** the effective module policy uses empty `imports`, empty `typeImports`, empty `exports`, `shared: false`, and `entrypoints: ['index.ts']`
