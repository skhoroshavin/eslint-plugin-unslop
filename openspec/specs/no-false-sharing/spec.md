## ADDED Requirements

### Requirement: no-false-sharing SHALL take no rule-level options

Empty options schema (`schema: []`). All module ownership and policy configuration SHALL come from `settings.unslop.architecture` via the shared `architecture-config` capability.

#### Scenario: Rule configured without options

- **WHEN** enabled as `'error'` with no options
- **THEN** reads shared module configuration from the shared architecture config

#### Scenario: Module marked shared is subject to false-sharing enforcement

- **WHEN** the effective module policy from the shared architecture config includes `shared: true`
- **THEN** enforce sharing on symbols exported from that module's entrypoints

#### Scenario: Module not marked shared is exempt from false-sharing enforcement

- **WHEN** the effective module policy from the shared architecture config does not include `shared: true`
- **THEN** no reports for files within that module

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

### Requirement: no-false-sharing SHALL count consumers in directory mode only

Directory-level grouping for consumer counts. Both value and type-only imports count. Same-shared-module internal consumers collapse to one group. Internal-only group is insufficient.

#### Scenario: Symbol imported from one directory group

- **WHEN** imported by files in only one directory-level consumer group
- **THEN** report

#### Scenario: Symbol imported from two directory groups

- **WHEN** imported by files in at least two distinct directory-level consumer groups
- **THEN** allow

#### Scenario: Multiple internal consumers collapse to one shared-module group

- **WHEN** multiple files in the same shared module consume the symbol
- **THEN** count as one consumer group

#### Scenario: Internal-only consumer group is insufficient

- **WHEN** only consumers are within the same shared module
- **THEN** report

### Requirement: no-false-sharing SHALL report symbol-level consumer context

Diagnostics MUST include symbol name and consumer context.

#### Scenario: Single-consumer symbol report includes consumer group

- **WHEN** one consumer group exists
- **THEN** diagnostic includes symbol name, count, and group identity

#### Scenario: Zero-consumer symbol report indicates no consumers

- **WHEN** zero consumers exist
- **THEN** diagnostic includes symbol name and no-consumer indication

### Requirement: no-false-sharing SHALL count type-only imports as consumers

Type-only imports MUST be counted.

#### Scenario: Type-only imports satisfy sharing threshold

- **WHEN** two or more distinct groups use `import type`
- **THEN** allow
