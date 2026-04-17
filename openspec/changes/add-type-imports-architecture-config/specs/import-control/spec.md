## MODIFIED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

`unslop/import-control` MUST read `settings.unslop.architecture` through the shared `architecture-config` capability. Canonical module paths, architecture key ownership, unsupported-key validation, anonymous-module behavior, default `entrypoints` semantics, and `typeImports` semantics are defined by `architecture-config` and MUST be reused by this rule.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** `unslop/import-control` uses that shared policy

#### Scenario: Architecture settings are absent

- **WHEN** `unslop/import-control` runs without `settings.unslop.architecture`
- **THEN** the rule applies anonymous module defaults (deny all cross-module imports, allow only index entrypoints)

#### Scenario: Configured module omits entrypoints

- **WHEN** a module policy omits `entrypoints`
- **THEN** allowed entrypoints default to `['index.ts']`

### Requirement: Import control SHALL enforce deny-by-default module boundaries

Cross-module imports are forbidden unless the importer explicitly allows the target canonical module path via `imports`, the declaration is type-only and the target canonical module path matches `typeImports`, or the import is a shallow relative entrypoint import. Type-only imports also remain allowed when the target matches `imports`. Module ownership and anonymous-module fallback are derived from the shared `architecture-config` capability. `imports` and `typeImports` patterns use non-recursive canonical module path matching: exact module path, direct child via `/*`, and self-or-child via `/+`. When semantic context cannot be established for a file that is subject to this rule, the rule MUST report a configuration error instead of becoming a no-op.

#### Scenario: Allowed cross-module edge

- **WHEN** importer policy includes the target canonical module path in `imports`
- **THEN** allow

#### Scenario: Type-only cross-module edge allowed by imports

- **WHEN** a type-only import targets a canonical module path included in `imports`
- **THEN** allow

#### Scenario: Type-only cross-module edge allowed by typeImports

- **WHEN** a type-only import targets a canonical module path included in `typeImports`
- **THEN** allow

#### Scenario: Mixed import declaration does not use typeImports

- **WHEN** an import declaration includes both value and type specifiers and only `typeImports` matches the target canonical module path
- **THEN** report an error

#### Scenario: Undeclared cross-module edge

- **WHEN** importer policy does not include the target canonical module path in `imports`, the declaration is not a type-only import matched by `typeImports`, and it is not a shallow relative entrypoint import
- **THEN** report an error

#### Scenario: Exact import allowlist pattern matches only exact module

- **WHEN** `imports` contains `parent` and target canonical module path is `parent`
- **THEN** allow

#### Scenario: Exact import allowlist pattern does not match child module

- **WHEN** `imports` contains `parent` and target canonical module path is `parent/child`
- **THEN** report an error

#### Scenario: Child wildcard import allowlist pattern matches direct child module

- **WHEN** `imports` contains `parent/*` and target canonical module path is `parent/child`
- **THEN** allow

#### Scenario: Child wildcard import allowlist pattern does not match parent module

- **WHEN** `imports` contains `parent/*` and target canonical module path is `parent`
- **THEN** report an error

#### Scenario: Child wildcard import allowlist pattern does not match deeper module

- **WHEN** `imports` contains `parent/*` and target canonical module path is `parent/child/sub`
- **THEN** report an error

#### Scenario: Self-or-child import allowlist pattern matches parent module

- **WHEN** `imports` contains `parent/+` and target canonical module path is `parent`
- **THEN** allow

#### Scenario: Self-or-child import allowlist pattern matches direct child module

- **WHEN** `imports` contains `parent/+` and target canonical module path is `parent/child`
- **THEN** allow

#### Scenario: Self-or-child import allowlist pattern does not match deeper module

- **WHEN** `imports` contains `parent/+` and target canonical module path is `parent/child/sub`
- **THEN** report an error

#### Scenario: Type import allowlist pattern matches direct child module

- **WHEN** `typeImports` contains `parent/*` and a type-only import targets canonical module path `parent/child`
- **THEN** allow

#### Scenario: Type import allowlist pattern does not match deeper module

- **WHEN** `typeImports` contains `parent/*` and a type-only import targets canonical module path `parent/child/sub`
- **THEN** report an error

#### Scenario: Unmatched module edge

- **WHEN** a file belongs to no configured architecture key
- **THEN** treat it as an anonymous module with empty `imports` and empty `typeImports` policy

#### Scenario: Semantic project unavailable

- **WHEN** no usable TypeScript semantic project exists for a file that must be analyzed
- **THEN** report a configuration error with actionable path context

#### Scenario: File not included by discovered tsconfig

- **WHEN** a tsconfig is discovered but the linted file is outside that project's file set
- **THEN** report a configuration error with the linted file path and discovered tsconfig path

### Requirement: Import control SHALL enforce public-entrypoint-only cross-module imports

Cross-module imports allowed by `imports`, and type-only cross-module imports allowed by either `imports` or `typeImports`, are allowed only to files in the target module's `entrypoints` (default `['index.ts']`). Resolution uses the TypeScript semantic project.

#### Scenario: Cross-module import targets configured entrypoint via explicit policy

- **WHEN** import resolves to a file in target's `entrypoints` and importer allows target through `imports`
- **THEN** allow

#### Scenario: Cross-module alias import targets configured entrypoint via explicit policy

- **WHEN** alias import resolves to a file in target's `entrypoints` and importer allows target through `imports`
- **THEN** allow

#### Scenario: Type-only cross-module import targets configured entrypoint via typeImports

- **WHEN** a type-only import resolves to a file in target's `entrypoints` and importer allows the target through `typeImports`
- **THEN** allow

#### Scenario: Cross-module import to configured module defaults to index entrypoint

- **WHEN** import resolves to `index.ts` in a target that omits `entrypoints`
- **THEN** allow

#### Scenario: Cross-module import targets internal file

- **WHEN** an allowed cross-module import resolves to a file not in target's `entrypoints`
- **THEN** report an error

#### Scenario: Type-only cross-module import targets internal file

- **WHEN** a type-only import allowed by `typeImports` resolves to a file not in target's `entrypoints`
- **THEN** report an error

#### Scenario: Cross-module import to anonymous module allows only index entrypoint

- **WHEN** target is anonymous and import resolves to `index.ts`
- **THEN** allow

#### Scenario: Cross-module import to anonymous module non-index entrypoint

- **WHEN** target is anonymous and import resolves to a non-`index.ts` file
- **THEN** report an error
