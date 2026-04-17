## ADDED Requirements

### Requirement: Export control SHALL forbid export-all declarations

`unslop/export-control` MUST reject `export * from ...` in all files.

#### Scenario: Entrypoint uses export-all

- **WHEN** an entrypoint file contains `export * from ...`
- **THEN** report an error

#### Scenario: Non-entrypoint file uses export-all

- **WHEN** any non-entrypoint file contains `export * from ...`
- **THEN** report an error

#### Scenario: Constrained entrypoint uses export-all

- **WHEN** an entrypoint file in a constrained module contains `export * from ...`
- **THEN** report an error

### Requirement: Export control SHALL enforce optional symbol contracts on module entrypoints

Permissive by default. Regex-based symbol contracts apply only when a module defines `exports` patterns.

#### Scenario: Module has no exports policy

- **WHEN** a module does not define `exports`
- **THEN** no symbol-name violations

#### Scenario: Exported symbol matches contract

- **WHEN** an exported symbol matches at least one configured regex
- **THEN** allow

#### Scenario: Exported symbol violates contract

- **WHEN** an exported symbol matches no configured regex
- **THEN** report an error
