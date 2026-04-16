## MODIFIED Requirements

### Requirement: no-whitebox-testing SHALL allow imports through the current module entrypoint

Allow imports resolving to files in the current module's configured `entrypoints`. Default entrypoint behavior and module ownership SHALL be determined by the shared `architecture-config` capability instead of being redefined by this rule.

#### Scenario: Test imports default index entrypoint through dot specifier

- **WHEN** `module/some.test.ts` imports `.` resolving to `module/index.ts`
- **THEN** allowed

#### Scenario: Test imports default index entrypoint through explicit index specifier

- **WHEN** imports `./index` or `./index.ts` resolving to `module/index.ts`
- **THEN** allowed

#### Scenario: Test imports configured non-index entrypoint

- **WHEN** import resolves to a file in the module's configured `entrypoints`
- **THEN** allowed

### Requirement: no-whitebox-testing SHALL fail open when architecture analysis is unavailable

`unslop/no-whitebox-testing` MUST remain a no-op when architecture settings are absent. When architecture settings are present but the shared `architecture-config` capability cannot be loaded, contains unsupported key selectors, or required TypeScript semantic context is unavailable, invalid, or excludes the linted test file, the rule MUST report a configuration error instead of silently skipping checks.

#### Scenario: Missing architecture settings

- **WHEN** no `settings.unslop.architecture`
- **THEN** report nothing

#### Scenario: Unsupported architecture key selector

- **WHEN** architecture settings are present and contain an unsupported architecture key selector
- **THEN** report a configuration error

#### Scenario: Semantic project unavailable

- **WHEN** architecture settings are present and no usable TypeScript project is available
- **THEN** report a configuration error with actionable path context

#### Scenario: Linted test file outside discovered tsconfig project

- **WHEN** architecture settings are present and a tsconfig is discovered but does not include the linted test file
- **THEN** report a configuration error with linted file and tsconfig path details
