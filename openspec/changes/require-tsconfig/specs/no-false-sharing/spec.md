## MODIFIED Requirements

### Requirement: no-false-sharing SHALL evaluate shared entrypoint exports at symbol granularity

Evaluate whether symbols exported from shared module entrypoints (`index.ts` and `types.ts`) are consumed by at least two distinct consumer groups. Uses TypeScript semantic project. Symbol comparisons resolve aliases and re-exports to canonical identity. Both public entrypoint imports and same-shared-module internal usage count. Boundary-violating imports of internal files from outside do NOT count. When semantic context cannot be established for an analyzed file, the rule MUST report a configuration error.

#### Scenario: Exported symbol has two distinct consumers

- **WHEN** a symbol is imported by at least two distinct consumer groups
- **THEN** allow

#### Scenario: Exported symbol has one consumer group

- **WHEN** a symbol is imported by only one consumer group
- **THEN** report

#### Scenario: Consumer uses tsconfig alias to import shared symbol

- **WHEN** a consumer imports via alias configured in `compilerOptions.paths`
- **THEN** resolve through semantic project and count as valid consumer

#### Scenario: Re-exported symbol has an internal shared consumer

- **WHEN** an internal file imports from the backing file for a re-exported symbol
- **THEN** counts toward one internal consumer group

#### Scenario: Direct entrypoint export has an internal shared consumer

- **WHEN** a same-module file imports from the shared entrypoint
- **THEN** counts toward one internal consumer group

#### Scenario: External import of internal backing file does not satisfy sharing

- **WHEN** a file outside the module imports from the internal backing file
- **THEN** not counted

#### Scenario: Alias import counts as a symbol consumer

- **WHEN** a symbol is imported through any alias path
- **THEN** counts as a local consumer

#### Scenario: Semantic project unavailable for linted file

- **WHEN** no usable TypeScript semantic project
- **THEN** report a configuration error with actionable path context

#### Scenario: Linted file outside discovered tsconfig project

- **WHEN** a tsconfig is discovered but does not include the linted file
- **THEN** report a configuration error with linted file and tsconfig path details
