## MODIFIED Requirements

### Requirement: no-whitebox-testing SHALL fail open when architecture analysis is unavailable

`unslop/no-whitebox-testing` MUST remain a no-op when architecture settings are absent. When architecture settings are present but required TypeScript semantic context is unavailable, invalid, or excludes the linted test file, the rule MUST report a configuration error instead of silently skipping checks.

#### Scenario: Missing architecture settings

- **WHEN** no `settings.unslop.architecture`
- **THEN** report nothing

#### Scenario: Semantic project unavailable

- **WHEN** architecture settings are present and no usable TypeScript project is available
- **THEN** report a configuration error with actionable path context

#### Scenario: Linted test file outside discovered tsconfig project

- **WHEN** architecture settings are present and a tsconfig is discovered but does not include the linted test file
- **THEN** report a configuration error with linted file and tsconfig path details
