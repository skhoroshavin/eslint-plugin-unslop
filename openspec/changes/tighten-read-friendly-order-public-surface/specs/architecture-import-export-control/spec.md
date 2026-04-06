## MODIFIED Requirements

### Requirement: Export control SHALL forbid export-all declarations

`unslop/export-control` MUST reject `export * from ...` declarations in all files.

#### Scenario: Entrypoint uses export-all

- **WHEN** `index.ts` or `types.ts` contains `export * from ...`
- **THEN** `unslop/export-control` MUST report an error

#### Scenario: Non-entrypoint file uses export-all

- **WHEN** any non-entrypoint file contains `export * from ...`
- **THEN** `unslop/export-control` MUST report an error

#### Scenario: Constrained entrypoint uses export-all

- **WHEN** `index.ts` or `types.ts` in a constrained module contains `export * from ...`
- **THEN** `unslop/export-control` MUST report an error
