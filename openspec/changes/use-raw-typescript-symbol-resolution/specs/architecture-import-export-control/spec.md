## MODIFIED Requirements

### Requirement: Import control SHALL enforce deny-by-default module boundaries

`unslop/import-control` MUST treat cross-module imports as forbidden unless the importer module explicitly allows the target module via `imports`, or the import is implicitly allowed as a shallow relative entrypoint import (see below). Importer and target module identity MUST be derived from the TypeScript semantic project for the linted file. If a semantic project cannot be created for that file, `unslop/import-control` MUST report nothing for that file.

#### Scenario: Allowed cross-module edge

- **WHEN** importer module policy includes target module matcher in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Undeclared cross-module edge

- **WHEN** importer module policy does not include target module matcher in `imports`, and the import is not a shallow relative entrypoint import
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Unmatched module edge

- **WHEN** either importer file or import target file does not match any architecture module key
- **THEN** `unslop/import-control` MUST treat it as an anonymous module keyed by its directory with an empty `imports` policy, and apply normal boundary checks against that default

#### Scenario: Semantic project unavailable

- **WHEN** a linted file has no usable TypeScript semantic project for architecture analysis
- **THEN** `unslop/import-control` MUST become a no-op and report no boundary errors for that file

### Requirement: Import control SHALL enforce public-entrypoint-only cross-module imports

`unslop/import-control` MUST allow cross-module imports only when the import target resolves to `index.ts` or `types.ts` in the target module. Import target resolution MUST use the TypeScript semantic project for the linted file rather than handwritten alias or extension probing.

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

`unslop/import-control` MUST enforce same-module depth limits for local imports based on resolved target identity from the TypeScript semantic project, regardless of whether the import uses `./` relative syntax or any tsconfig-configured alias syntax.

#### Scenario: Same-module shallow relative import is allowed

- **WHEN** a same-module relative import reaches at most one level deeper
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Same-module deep relative import is rejected

- **WHEN** a same-module relative import reaches two or more levels deeper
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Same-module deep alias import is rejected

- **WHEN** a same-module import using any tsconfig-configured alias resolves to a path that reaches two or more levels deeper in the same module instance
- **THEN** `unslop/import-control` MUST report an error
