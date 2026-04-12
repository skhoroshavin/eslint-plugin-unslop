## ADDED Requirements

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

### Requirement: no-false-sharing SHALL take no rule-level options

`unslop/no-false-sharing` MUST declare an empty options schema (`schema: []`). All configuration comes from `settings.unslop.architecture`. Rule-level options are not supported.

#### Scenario: Rule configured without options

- **WHEN** `unslop/no-false-sharing` is enabled as `'error'` with no options
- **THEN** it MUST read shared module configuration from `settings.unslop.architecture`

### Requirement: no-false-sharing SHALL count consumers in directory mode only

`unslop/no-false-sharing` MUST count distinct consumer groups using directory-level grouping and apply the threshold to shared entrypoint-exported symbols. Both value imports and type-only imports count as consumers. Same-shared-module internal consumers count as one collapsed internal consumer group for the shared module instance, whether they import from the shared entrypoint file or a backing internal file for a re-exported symbol. An internal consumer group alone is insufficient to satisfy the sharing threshold.

#### Scenario: Symbol imported from one directory group

- **WHEN** a shared entrypoint-exported symbol is imported by files in only one directory-level consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

#### Scenario: Symbol imported from two directory groups

- **WHEN** a shared entrypoint-exported symbol is imported by files in at least two distinct directory-level consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

#### Scenario: Multiple internal consumers collapse to one shared-module group

- **WHEN** multiple files in the same shared module consume the same exported symbol through the shared entrypoint or its backing internal file
- **THEN** `unslop/no-false-sharing` MUST count those internal consumers as one consumer group for that shared module instance

#### Scenario: Internal-only consumer group is insufficient

- **WHEN** the only consumers of a shared entrypoint-exported symbol are files within that same shared module
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

### Requirement: Import control SHALL forbid local cross-module namespace imports

`unslop/import-control` MUST reject `import * as X from '...'` when the import target resolves to another module within the local project architecture.

#### Scenario: Local cross-module namespace import is rejected

- **WHEN** a file imports from another local module using `import * as Namespace from '<local-path-or-alias>'`
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: External dependency namespace import is allowed

- **WHEN** a file imports from an external package using `import * as Namespace from 'package-name'`
- **THEN** `unslop/import-control` MUST NOT report an error for namespace import usage

### Requirement: Import control SHALL enforce deny-by-default module boundaries

`unslop/import-control` MUST treat cross-module imports as forbidden unless the importer module explicitly allows the target module via `imports`, or the import is implicitly allowed as a shallow relative entrypoint import (see below). Importer and target module identity MUST be derived from the TypeScript semantic project for the linted file. If a semantic project cannot be created for that file, `unslop/import-control` MUST report nothing for that file.

#### Scenario: Allowed cross-module edge

- **WHEN** importer module policy includes target module matcher in `imports`
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Undeclared cross-module edge

- **WHEN** importer module policy does not include target module matcher in `imports`, and the import is not a shallow relative entrypoint import
- **THEN** `unslop/import-control` MUST report an error

#### Scenario: Wildcard import allowlist pattern matches explicitly-named sub-module

- **WHEN** importer module policy includes a wildcard pattern such as `"parent/*"` in `imports`
- **AND** the import target is matched to an explicitly-named module with matcher `"parent/child"` (because an exact definition exists and takes precedence)
- **THEN** `unslop/import-control` MUST allow the import

#### Scenario: Wildcard import allowlist pattern does not match deeper explicitly-named sub-module

- **WHEN** importer module policy includes a wildcard pattern such as `"parent/*"` in `imports`
- **AND** the import target is matched to a deeper explicitly-named module with matcher `"parent/child/sub"` (three segments vs two)
- **THEN** `unslop/import-control` MUST report an error, because `"parent/*"` covers exactly one wildcard segment

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

### Requirement: Import control SHALL implicitly allow shallow relative imports to direct child entrypoints

`unslop/import-control` MUST allow a `./`-relative import that is at most one level deep and resolves to a public entrypoint (`index.ts` or `types.ts`), without requiring an explicit `imports` policy entry. This allows a module to import the public entrypoint of any direct child sub-module without boilerplate configuration.

#### Scenario: Shallow relative import to child module entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep and resolves to `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST allow the import regardless of `imports` policy

#### Scenario: Shallow relative import to child module non-entrypoint

- **WHEN** a file uses a `./`-relative import that is one level deep but resolves to a file other than `index.ts` or `types.ts`
- **THEN** `unslop/import-control` MUST apply normal boundary checks

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
