## Purpose

TBD.

## ADDED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

The plugin SHALL read architecture policy from `settings.unslop.architecture`, where module policies are keyed by module matcher and each module MAY define `imports`, `exports`, and `shared`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture rules MUST use that shared policy as their configuration source

#### Scenario: Architecture settings are missing

- **WHEN** architecture rules run without `settings.unslop.architecture`
- **THEN** rules MUST fail gracefully without throwing

### Requirement: Import control SHALL enforce deny-by-default module boundaries

`unslop/import-control` MUST treat cross-module imports as forbidden unless the importer module explicitly allows the target module via `imports`, or the import is implicitly allowed as a shallow relative entrypoint import (see below).

#### Scenario: Allowed cross-module edge

- **WHEN** importer module policy includes target module matcher in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Undeclared cross-module edge

- **WHEN** importer module policy does not include target module matcher in `imports`, and the import is not a shallow relative entrypoint import
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Unmatched module edge

- **WHEN** either importer file or import target file does not match any architecture module key
- **THEN** `unslop/import-control` MUST treat it as an anonymous module keyed by its directory with an empty `imports` policy, and apply normal boundary checks against that default

### Requirement: Import control SHALL enforce public-entrypoint-only cross-module imports

`unslop/import-control` MUST allow cross-module imports only when the import target resolves to `index.ts` or `types.ts` in the target module.

#### Scenario: Cross-module import targets entrypoint via explicit policy

- **WHEN** a cross-module import resolves to `index.ts` or `types.ts` and the importer module policy explicitly allows the target module in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Cross-module import targets internal file

- **WHEN** a cross-module import resolves to any file other than `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST report an error

### Requirement: Import control SHALL implicitly allow shallow relative imports to direct child entrypoints

`unslop/import-control` MUST allow a `./`-relative import that is at most one level deep and resolves to a public entrypoint (`index.ts` or `types.ts`), without requiring an explicit `imports` policy entry. This allows a module to import the public entrypoint of any direct child sub-module without boilerplate configuration.

#### Scenario: Shallow relative import to child module entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep and resolves to `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST allow the import regardless of `imports` policy

#### Scenario: Shallow relative import to child module non-entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep but resolves to a file other than `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST apply normal boundary checks

### Requirement: Import control SHALL subsume shallow deep-import behavior within modules

`unslop/import-control` MUST enforce shallow relative imports within the same module instance by allowing at most one level deeper path traversal.

#### Scenario: Same-module import one level deep

- **WHEN** a same-module relative import reaches one level deeper
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Same-module import two or more levels deep

- **WHEN** a same-module relative import reaches two or more levels deeper
- **THEN** `unslop/import-control` MUST report an error

### Requirement: Export control SHALL enforce optional symbol contracts on module entrypoints

`unslop/export-control` MUST be permissive by default and MUST enforce regex-based symbol contracts only for modules that define `exports` patterns.

#### Scenario: Module has no exports policy

- **WHEN** a module does not define `exports`
- **THEN** `unslop/export-control` MUST not report symbol-name violations for that module

#### Scenario: Exported symbol matches contract

- **WHEN** a constrained module exports a symbol from `index.ts` or `types.ts` that matches at least one configured regex
- **THEN** `unslop/export-control` MUST allow that export

#### Scenario: Exported symbol violates contract

- **WHEN** a constrained module exports a symbol from `index.ts` or `types.ts` that matches no configured regex
- **THEN** `unslop/export-control` MUST report an error at the export declaration or re-export site

#### Scenario: Constrained entrypoint uses export-all

- **WHEN** `index.ts` or `types.ts` in a constrained module contains `export * from ...`
- **THEN** `unslop/export-control` MUST report an error
