## MODIFIED Requirements

### Requirement: Module marked shared is subject to false-sharing enforcement

For modules marked `shared: true`, `unslop/no-false-sharing` MUST enforce sharing on entrypoint-exported symbols instead of file-level targets.

- **WHEN** a module policy includes `shared: true` in `settings.unslop.architecture`
- **THEN** `unslop/no-false-sharing` MUST enforce sharing on symbols exported from that module's `index.ts` or `types.ts` entrypoints

#### Scenario: Alias import counts as a symbol consumer

- **WHEN** a symbol exported from a shared module entrypoint is imported through an alias path under `sourceRoot` (for example `@/ui/components`, `@/ui/components/index`, `@/utils/index.js`)
- **THEN** `unslop/no-false-sharing` MUST count that import as a local consumer of the resolved exported symbol

### Requirement: no-false-sharing SHALL count consumers in directory mode only

`unslop/no-false-sharing` MUST count distinct consumer groups using directory-level grouping and apply the threshold to shared entrypoint-exported symbols. Both value imports and type-only imports count as consumers.

#### Scenario: Symbol imported from one directory group

- **WHEN** a shared entrypoint-exported symbol is imported by files in only one directory-level consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

#### Scenario: Symbol imported from two directory groups

- **WHEN** a shared entrypoint-exported symbol is imported by files in at least two distinct directory-level consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

## ADDED Requirements

### Requirement: Import control SHALL forbid local cross-module namespace imports

`unslop/import-control` MUST reject `import * as X from '...'` when the import target resolves to another module within the local project architecture.

#### Scenario: Local cross-module namespace import is rejected

- **WHEN** a file imports from another local module using `import * as Namespace from '<local-path-or-alias>'`
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: External dependency namespace import is allowed

- **WHEN** a file imports from an external package using `import * as Namespace from 'package-name'`
- **THEN** `unslop/import-control` MUST NOT report an error for namespace import usage

### Requirement: Export control SHALL forbid export-all on shared module entrypoints

`unslop/export-control` MUST reject `export * from ...` in `index.ts` and `types.ts` for modules marked `shared: true`.

#### Scenario: Shared entrypoint uses export-all

- **WHEN** `index.ts` or `types.ts` of a shared module contains `export * from ...`
- **THEN** `unslop/export-control` MUST report an error
