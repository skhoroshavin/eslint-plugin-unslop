## MODIFIED Requirements

### Requirement: Import control SHALL enforce deny-by-default module boundaries

Cross-module imports are forbidden unless the importer explicitly allows the target via `imports` or the import is a shallow relative entrypoint import. Module identity is derived from the TypeScript semantic project. When semantic context cannot be established for a file that is subject to this rule, the rule MUST report a configuration error instead of becoming a no-op.

#### Scenario: Allowed cross-module edge

- **WHEN** importer policy includes target in `imports`
- **THEN** allow

#### Scenario: Undeclared cross-module edge

- **WHEN** importer policy does not include target in `imports` and it is not a shallow relative entrypoint import
- **THEN** report an error

#### Scenario: Wildcard import allowlist pattern matches explicitly-named sub-module

- **WHEN** `imports` contains `"parent/*"` and target matches `"parent/child"`
- **THEN** allow

#### Scenario: Wildcard import allowlist pattern does not match deeper explicitly-named sub-module

- **WHEN** `imports` contains `"parent/*"` and target matches `"parent/child/sub"`
- **THEN** report an error (`"parent/*"` covers one wildcard segment)

#### Scenario: Unmatched module edge

- **WHEN** a file does not match any module key
- **THEN** treat as anonymous module with empty `imports` policy

#### Scenario: Semantic project unavailable

- **WHEN** no usable TypeScript semantic project exists for a file that must be analyzed
- **THEN** report a configuration error with actionable path context

#### Scenario: File not included by discovered tsconfig

- **WHEN** a tsconfig is discovered but the linted file is outside that project's file set
- **THEN** report a configuration error with the linted file path and discovered tsconfig path
