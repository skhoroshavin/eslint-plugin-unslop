## MODIFIED Requirements

### Requirement: no-single-use-constants SHALL count project-wide semantic uses

For exported constants, count uses across all files in the semantic TypeScript project by canonical symbol identity. If semantic project context cannot be created for the linted file, the rule MUST report a configuration error instead of no-op behavior.

#### Scenario: Exported constant is used from another file

- **WHEN** imported and read from another file
- **THEN** included in count

#### Scenario: Exported expression use counts

- **WHEN** `export const BAR = FOO` references FOO
- **THEN** FOO counted as a use

#### Scenario: Import declaration does not count as a use

- **WHEN** identifier only appears in `import { FOO } from '...'`
- **THEN** not counted

#### Scenario: Semantic project unavailable

- **WHEN** no semantic TypeScript project available
- **THEN** report a configuration error with actionable path context

#### Scenario: File is outside discovered tsconfig project

- **WHEN** a tsconfig is discovered but the linted file is not included by that project
- **THEN** report a configuration error including linted file and tsconfig path details
