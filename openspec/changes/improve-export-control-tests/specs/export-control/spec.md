## MODIFIED Requirements

### Requirement: Export control SHALL enforce optional symbol contracts on module entrypoints

Permissive by default. Regex-based symbol contracts apply only when a module defines `exports` patterns and the linted file is one of that module's configured `entrypoints`. The contract applies to direct named exports, source-bearing named exports, and default exports in those constrained entrypoint files.

#### Scenario: Module has no exports policy

- **WHEN** a module does not define `exports`
- **THEN** no symbol-name violations

#### Scenario: Non-entrypoint file in constrained module has no symbol contract enforcement

- **WHEN** a module defines `exports` patterns but the linted file is not one of that module's configured `entrypoints`
- **THEN** no symbol-name violations are reported for that file

#### Scenario: Non-entrypoint type export in constrained module has no symbol contract enforcement

- **WHEN** a module defines `exports` patterns but a non-entrypoint file exports a type declaration
- **THEN** no symbol-name violations are reported for that file

#### Scenario: Direct named export matches contract

- **WHEN** a constrained entrypoint exports a named symbol that matches at least one configured regex
- **THEN** allow

#### Scenario: Direct named export violates contract

- **WHEN** a constrained entrypoint exports a named symbol that matches no configured regex
- **THEN** report an error

#### Scenario: Direct type export matches contract

- **WHEN** a constrained entrypoint exports a type declaration whose exported name matches at least one configured regex
- **THEN** allow

#### Scenario: Direct type export violates contract

- **WHEN** a constrained entrypoint exports a type declaration whose exported name matches no configured regex
- **THEN** report an error

#### Scenario: Source-bearing named export matches contract

- **WHEN** a constrained entrypoint re-exports a named symbol from another module and the exported name matches at least one configured regex
- **THEN** allow

#### Scenario: Source-bearing named export violates contract

- **WHEN** a constrained entrypoint re-exports a named symbol from another module and the exported name matches no configured regex
- **THEN** report an error

#### Scenario: Default export matches contract

- **WHEN** a constrained entrypoint contains a default export and at least one configured regex matches the symbol name `default`
- **THEN** allow

#### Scenario: Default export violates contract

- **WHEN** a constrained entrypoint contains a default export and no configured regex matches the symbol name `default`
- **THEN** report an error
