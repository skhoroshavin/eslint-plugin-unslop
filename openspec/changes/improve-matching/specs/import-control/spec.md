## MODIFIED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

`unslop/import-control` MUST read `settings.unslop.architecture` through the shared `architecture-config` capability. Canonical module paths, architecture key ownership, unsupported-key validation, anonymous-module behavior, and default `entrypoints` semantics are defined by `architecture-config` and MUST be reused by this rule.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** `unslop/import-control` uses that shared policy

#### Scenario: Architecture settings are missing

- **WHEN** `unslop/import-control` runs without `settings.unslop.architecture`
- **THEN** the rule fails gracefully without throwing

#### Scenario: Unsupported architecture key selector is reported

- **WHEN** `settings.unslop.architecture` contains an unsupported key selector
- **THEN** `unslop/import-control` reports a configuration error via the shared architecture policy reader

### Requirement: Import control SHALL enforce deny-by-default module boundaries

Cross-module imports are forbidden unless the importer explicitly allows the target canonical module path via `imports` or the import is a shallow relative entrypoint import. Module ownership and anonymous-module fallback are derived from the shared `architecture-config` capability. `imports` patterns use non-recursive canonical module path matching: exact module path, direct child via `/*`, and self-or-child via `/+`. When semantic context cannot be established for a file that is subject to this rule, the rule MUST report a configuration error instead of becoming a no-op.

#### Scenario: Allowed cross-module edge

- **WHEN** importer policy includes the target canonical module path in `imports`
- **THEN** allow

#### Scenario: Undeclared cross-module edge

- **WHEN** importer policy does not include the target canonical module path in `imports` and it is not a shallow relative entrypoint import
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

#### Scenario: Unmatched module edge

- **WHEN** a file belongs to no configured architecture key
- **THEN** treat it as an anonymous module with empty `imports` policy

#### Scenario: Semantic project unavailable

- **WHEN** no usable TypeScript semantic project exists for a file that must be analyzed
- **THEN** report a configuration error with actionable path context

#### Scenario: File not included by discovered tsconfig

- **WHEN** a tsconfig is discovered but the linted file is outside that project's file set
- **THEN** report a configuration error with the linted file path and discovered tsconfig path
