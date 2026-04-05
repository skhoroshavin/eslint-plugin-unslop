## MODIFIED Requirements

### Requirement: Import control SHALL enforce public-entrypoint-only cross-module imports

`unslop/import-control` MUST allow cross-module imports only when the import target resolves to `index.ts` or `types.ts` in the target module.

#### Scenario: Cross-module import targets entrypoint via explicit policy

- **WHEN** a cross-module import resolves to `index.ts` or `types.ts` and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module import targets internal file

- **WHEN** a cross-module import resolves to any file other than `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Cross-module alias import targets entrypoint via explicit policy

- **WHEN** a cross-module import uses a source-root alias path and resolves to `index.ts` or `types.ts`, and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

### Requirement: Import control SHALL subsume shallow deep-import behavior within modules

`unslop/import-control` MUST enforce same-module depth limits for local imports based on resolved target identity, regardless of whether the import uses `./` relative syntax or source-root alias syntax.

#### Scenario: Same-module shallow relative import is allowed

- **WHEN** a same-module relative import reaches at most one level deeper
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Same-module deep relative import is rejected

- **WHEN** a same-module relative import reaches two or more levels deeper
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Same-module deep alias import is rejected

- **WHEN** a same-module source-root alias import resolves to a path that reaches two or more levels deeper in the same module instance
- **THEN** `unslop/import-control` MUST report an error
