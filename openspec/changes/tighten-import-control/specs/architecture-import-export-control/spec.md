## MODIFIED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

The plugin SHALL read architecture policy from `settings.unslop.architecture`, where module policies are keyed by module matcher and each module MAY define `imports`, `exports`, `shared`, and `entrypoints`. The `entrypoints` field MUST be a list of strings and MUST default to `['index.ts']` when omitted for a configured module. A module with `shared: true` is subject to false-sharing enforcement by `unslop/no-false-sharing`. The `settings.unslop.sourceRoot` setting is removed; source root is derived from `tsconfig.json`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture rules MUST use that shared policy as their configuration source

#### Scenario: Architecture settings are missing

- **WHEN** architecture rules run without `settings.unslop.architecture`
- **THEN** rules MUST fail gracefully without throwing

#### Scenario: Configured module omits entrypoints

- **WHEN** a module policy omits `entrypoints`
- **THEN** architecture policy parsing MUST treat that module's allowed entrypoints as `['index.ts']`

#### Scenario: Module marked shared is subject to false-sharing enforcement

- **WHEN** a module policy includes `shared: true` in `settings.unslop.architecture`
- **THEN** `unslop/no-false-sharing` MUST enforce sharing on symbols exported from that module's `index.ts` or `types.ts` entrypoints

#### Scenario: Alias import counts as a symbol consumer

- **WHEN** a symbol exported from a shared module entrypoint is imported through any alias path configured in `compilerOptions.paths` (for example `@/ui/components`, `~/utils/index`, `@components/Button`)
- **THEN** `unslop/no-false-sharing` MUST count that import as a local consumer of the resolved exported symbol

#### Scenario: Module not marked shared is exempt from false-sharing enforcement

- **WHEN** a module policy does not include `shared: true`
- **THEN** `unslop/no-false-sharing` MUST NOT report errors for files within that module

### Requirement: Import control SHALL enforce public-entrypoint-only cross-module imports

`unslop/import-control` MUST allow cross-module imports only when the import target resolves to a file listed in the target module's configured `entrypoints`. If the target module is configured but omits `entrypoints`, the allowed set MUST be `['index.ts']`. If importer or import target is unmatched by architecture config and treated as an anonymous module, allowed cross-module entrypoints for that anonymous module MUST be `['index.ts']`. Import target resolution MUST use the TypeScript semantic project for the linted file rather than handwritten alias or extension probing.

#### Scenario: Cross-module import targets configured entrypoint via explicit policy

- **WHEN** a cross-module import resolves to a file listed in the target module's `entrypoints` and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module alias import targets configured entrypoint via explicit policy

- **WHEN** a cross-module import uses any tsconfig-configured alias path and resolves to a file listed in the target module's `entrypoints`, and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module import to configured module defaults to index entrypoint

- **WHEN** a cross-module import resolves to `index.ts` in a configured target module that does not define `entrypoints`, and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module import targets internal file

- **WHEN** a cross-module import resolves to any file not listed in the target module's allowed `entrypoints`
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Cross-module import to anonymous module allows only index entrypoint

- **WHEN** importer and target are treated as anonymous modules and a cross-module import resolves to `index.ts`
- **THEN** `unslop/import-control` MUST treat the target as an allowed entrypoint candidate and continue normal boundary checks

#### Scenario: Cross-module import to anonymous module non-index entrypoint

- **WHEN** importer and target are treated as anonymous modules and a cross-module import resolves to a file other than `index.ts`
- **THEN** `unslop/import-control` MUST report an error

### Requirement: Import control SHALL implicitly allow shallow relative imports to direct child entrypoints

`unslop/import-control` MUST allow a `./`-relative import that is at most one level deep and resolves to an allowed child-module entrypoint without requiring an explicit `imports` policy entry. For a configured child module, the allowed set is that module's `entrypoints` (defaulting to `['index.ts']` when omitted). For an unmatched child module treated as anonymous, the allowed set is `['index.ts']`.

#### Scenario: Shallow relative import to child module configured entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep and resolves to a file listed in the child module's allowed `entrypoints`
- **THEN** `unslop/import-control` MUST allow the import regardless of `imports` policy

#### Scenario: Shallow relative import to child module default entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep and resolves to `index.ts` in a configured child module with no explicit `entrypoints`
- **THEN** `unslop/import-control` MUST allow the import regardless of `imports` policy

#### Scenario: Shallow relative import to child module non-entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep but resolves to a file not listed in the child module's allowed `entrypoints`
- **THEN** `unslop/import-control` MUST apply normal boundary checks
