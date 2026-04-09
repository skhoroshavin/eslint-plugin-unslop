## MODIFIED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

The plugin SHALL read architecture policy from `settings.unslop.architecture`, where module policies are keyed by module matcher and each module MAY define `imports`, `exports`, and `shared`. A module with `shared: true` is subject to false-sharing enforcement by `unslop/no-false-sharing`. The `settings.unslop.sourceRoot` setting is removed; source root is derived from `tsconfig.json`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture rules MUST use that shared policy as their configuration source

#### Scenario: Architecture settings are missing

- **WHEN** architecture rules run without `settings.unslop.architecture`
- **THEN** rules MUST fail gracefully without throwing

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

`unslop/import-control` MUST allow cross-module imports only when the import target resolves to `index.ts` or `types.ts` in the target module.

#### Scenario: Cross-module import targets entrypoint via explicit policy

- **WHEN** a cross-module import resolves to `index.ts` or `types.ts` and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module alias import targets entrypoint via explicit policy

- **WHEN** a cross-module import uses any tsconfig-configured alias path and resolves to `index.ts` or `types.ts`, and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module import targets internal file

- **WHEN** a cross-module import resolves to any file other than `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST report an error

### Requirement: Import control SHALL subsume shallow deep-import behavior within modules

`unslop/import-control` MUST enforce same-module depth limits for local imports based on resolved target identity, regardless of whether the import uses `./` relative syntax or any tsconfig-configured alias syntax.

#### Scenario: Same-module shallow relative import is allowed

- **WHEN** a same-module relative import reaches at most one level deeper
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Same-module deep relative import is rejected

- **WHEN** a same-module relative import reaches two or more levels deeper
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Same-module deep alias import is rejected

- **WHEN** a same-module import using any tsconfig-configured alias resolves to a path that reaches two or more levels deeper in the same module instance
- **THEN** `unslop/import-control` MUST report an error

## REMOVED Requirements

### Requirement: no-false-sharing SHALL derive project root from sourceRoot path

**Reason**: Replaced by tsconfig-based project root derivation. Project root is now `dirname(tsconfig.json)` instead of scanning for `/<sourceRoot>/` in file paths. See new `tsconfig-resolution` capability.

**Migration**: Remove `settings.unslop.sourceRoot` from ESLint config. Ensure `tsconfig.json` exists with `compilerOptions.rootDir` or `compilerOptions.paths` that reveals the source directory.
