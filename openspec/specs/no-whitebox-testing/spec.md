## ADDED Requirements

### Requirement: no-whitebox-testing SHALL only evaluate recognized test files

`unslop/no-whitebox-testing` evaluates only files matching: `*.test.*`, `*.spec.*`, `*.*-test.*`, or `*.*-spec.*`.

#### Scenario: Recognized test file is checked

- **WHEN** file is named `some.test.ts`, `some.spec.ts`, `some.unit-test.ts`, or `some.unit-spec.ts`
- **THEN** analyze import declarations

#### Scenario: Non-test file is ignored

- **WHEN** basename matches none of the test patterns
- **THEN** report nothing

### Requirement: no-whitebox-testing SHALL reject same-directory private imports in tests

Report an `ImportDeclaration` when the import resolves to the same module instance, same directory, and is not an allowed `entrypoint`. Report must include the offending specifier.

#### Scenario: Test imports same-directory private sibling file

- **WHEN** `module/some.test.ts` imports `./model` resolving to `module/model.ts`
- **THEN** report

#### Scenario: Report includes offending import specifier

- **WHEN** a test imports `./model.ts` (same-directory private)
- **THEN** `./model.ts` included in error message

### Requirement: no-whitebox-testing SHALL allow imports through the current module entrypoint

Allow imports resolving to files in the module's configured `entrypoints` (default `['index.ts']`).

#### Scenario: Test imports default index entrypoint through dot specifier

- **WHEN** `module/some.test.ts` imports `.` resolving to `module/index.ts`
- **THEN** allowed

#### Scenario: Test imports default index entrypoint through explicit index specifier

- **WHEN** imports `./index` or `./index.ts` resolving to `module/index.ts`
- **THEN** allowed

#### Scenario: Test imports configured non-index entrypoint

- **WHEN** import resolves to a file in the module's configured `entrypoints`
- **THEN** allowed

### Requirement: no-whitebox-testing SHALL leave non-sibling and cross-module imports to import-control

MUST NOT report imports that do not resolve to same-directory private files in the current module instance.

#### Scenario: Test imports child submodule entrypoint

- **WHEN** imports `./submodule`, `./submodule/index`, or `./submodule/index.ts`
- **THEN** not reported

#### Scenario: Test imports child submodule internal file

- **WHEN** imports `./submodule/other.ts`
- **THEN** not reported

#### Scenario: Test imports another module

- **WHEN** imports `../othermodule` or `../othermodule/data.ts`
- **THEN** not reported

### Requirement: no-whitebox-testing SHALL fail open when architecture analysis is unavailable

MUST become a no-op when architecture settings or semantic project are unavailable.

#### Scenario: Missing architecture settings

- **WHEN** no `settings.unslop.architecture`
- **THEN** report nothing

#### Scenario: Semantic project unavailable

- **WHEN** no usable TypeScript project
- **THEN** report nothing

### Requirement: no-whitebox-testing SHALL be enabled in the full plugin config

`configs.full` MUST enable `unslop/no-whitebox-testing` at error severity.

#### Scenario: Full config enables no-whitebox-testing

- **WHEN** spreading `unslop.configs.full`
- **THEN** `unslop/no-whitebox-testing` enabled at error severity
