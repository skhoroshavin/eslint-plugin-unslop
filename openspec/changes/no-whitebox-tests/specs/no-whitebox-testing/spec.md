## ADDED Requirements

### Requirement: no-whitebox-testing SHALL only evaluate recognized test files

`unslop/no-whitebox-testing` MUST evaluate only files whose basename matches one of these test naming conventions: `*.test.*`, `*.spec.*`, `*.*-test.*`, or `*.*-spec.*`. Files that do not match one of those patterns MUST be ignored by this rule.

#### Scenario: Recognized test file is checked

- **WHEN** ESLint evaluates a file named `some.test.ts`, `some.spec.ts`, `some.unit-test.ts`, or `some.unit-spec.ts`
- **THEN** `unslop/no-whitebox-testing` MUST analyze that file's import declarations

#### Scenario: Non-test file is ignored

- **WHEN** ESLint evaluates a file whose basename matches none of the supported test naming conventions
- **THEN** `unslop/no-whitebox-testing` MUST report nothing for that file

### Requirement: no-whitebox-testing SHALL reject same-directory private imports in tests

In a recognized test file, `unslop/no-whitebox-testing` MUST report an `ImportDeclaration` when the import resolves to the same architecture module instance as the test file, the resolved target file is in the same directory as the test file, and the resolved target file is not one of that module instance's allowed `entrypoints`. The report MUST explain that tests must import through the module's public entrypoint and MUST include the offending import specifier.

#### Scenario: Test imports same-directory private sibling file

- **WHEN** `module/some.test.ts` imports `./model` and that import resolves to `module/model.ts` in the same module instance
- **THEN** `unslop/no-whitebox-testing` MUST report that import declaration

#### Scenario: Report includes offending import specifier

- **WHEN** a recognized test file imports a same-directory private file such as `./model.ts`
- **THEN** `unslop/no-whitebox-testing` MUST include `./model.ts` in the reported error message

### Requirement: no-whitebox-testing SHALL allow imports through the current module entrypoint

In a recognized test file, `unslop/no-whitebox-testing` MUST allow an import when it resolves to a file listed in the current module instance's configured `entrypoints`. If the module policy omits `entrypoints`, the allowed set for this rule MUST default to `['index.ts']`.

#### Scenario: Test imports default index entrypoint through dot specifier

- **WHEN** `module/some.test.ts` imports `.` and that import resolves to `module/index.ts`
- **THEN** `unslop/no-whitebox-testing` MUST NOT report that import

#### Scenario: Test imports default index entrypoint through explicit index specifier

- **WHEN** `module/some.test.ts` imports `./index` or `./index.ts` and that import resolves to `module/index.ts`
- **THEN** `unslop/no-whitebox-testing` MUST NOT report that import

#### Scenario: Test imports configured non-index entrypoint

- **WHEN** `module/some.test.ts` imports a specifier that resolves to a file listed in that module's configured `entrypoints`
- **THEN** `unslop/no-whitebox-testing` MUST NOT report that import

### Requirement: no-whitebox-testing SHALL leave non-sibling and cross-module imports to import-control

`unslop/no-whitebox-testing` MUST NOT report imports that do not resolve to same-directory private files in the current module instance. This includes imports into child submodules and imports into other modules, which remain governed by `unslop/import-control`.

#### Scenario: Test imports child submodule entrypoint

- **WHEN** `module/some.test.ts` imports `./submodule`, `./submodule/index`, or `./submodule/index.ts`
- **THEN** `unslop/no-whitebox-testing` MUST NOT report that import

#### Scenario: Test imports child submodule internal file

- **WHEN** `module/some.test.ts` imports `./submodule/other.ts`
- **THEN** `unslop/no-whitebox-testing` MUST NOT report that import

#### Scenario: Test imports another module

- **WHEN** `module/some.test.ts` imports `../othermodule`, `../othermodule/index.ts`, or `../othermodule/data.ts`
- **THEN** `unslop/no-whitebox-testing` MUST NOT report that import

### Requirement: no-whitebox-testing SHALL fail open when architecture analysis is unavailable

`unslop/no-whitebox-testing` MUST become a no-op when the file cannot be analyzed through the shared architecture policy and semantic TypeScript project context.

#### Scenario: Missing architecture settings

- **WHEN** the rule runs without `settings.unslop.architecture`
- **THEN** `unslop/no-whitebox-testing` MUST report nothing

#### Scenario: Semantic project unavailable

- **WHEN** the rule cannot create or access a semantic TypeScript project for the linted file
- **THEN** `unslop/no-whitebox-testing` MUST report nothing

### Requirement: no-whitebox-testing SHALL be enabled in the full plugin config

The plugin's `configs.full` export MUST enable `unslop/no-whitebox-testing` at error severity alongside the rest of the full ruleset.

#### Scenario: Full config enables no-whitebox-testing

- **WHEN** a user spreads `unslop.configs.full` into their ESLint config
- **THEN** `unslop/no-whitebox-testing` MUST be enabled at error severity
