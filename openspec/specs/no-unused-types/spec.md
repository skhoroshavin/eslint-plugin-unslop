## Purpose

Defines when `unslop/no-unused-types` reports unused exported type declarations.

## Requirements

### Requirement: no-unused-types SHALL report exported types with zero project-wide uses

The rule SHALL report an exported type alias or interface when its total real usage count across the semantic TypeScript project is 0. Only plain identifier bindings SHALL be eligible. Reports SHALL target the type declaration with message id `zeroUses`.

#### Scenario: Exported type with zero real uses is reported

- **WHEN** an exported type alias or interface has no references outside its declaration across the project
- **THEN** report with message id `zeroUses`

#### Scenario: Exported type with one or more real uses is not reported

- **WHEN** an exported type alias or interface is referenced at least once outside its declaration
- **THEN** not reported

### Requirement: no-unused-types SHALL exclude re-export and barrel positions

The rule MUST NOT count `export { T }`, `export type { T }`, or `export { T as X }` positions as real uses.

#### Scenario: Re-export does not count as a use

- **WHEN** a type identifier appears only in `export { T }` or `export type { T }` positions outside its declaring file
- **THEN** not counted as a real use

#### Scenario: Re-export alias does not count as a use

- **WHEN** a type identifier appears in `export { T as X }` position
- **THEN** not counted as a real use

### Requirement: no-unused-types SHALL count project-wide semantic uses

For exported type declarations, count uses across all files in the semantic TypeScript project by canonical symbol identity. If semantic project context cannot be created for the linted file, the rule MUST report a configuration error instead of no-op behavior.

#### Scenario: Exported type used in another file

- **WHEN** imported and referenced as a type annotation, type argument, or `typeof` query from another file
- **THEN** included in count

#### Scenario: Semantic project unavailable

- **WHEN** no semantic TypeScript project available
- **THEN** report a configuration error with actionable path context

#### Scenario: File is outside discovered tsconfig project

- **WHEN** a tsconfig is discovered but the linted file is not included by that project
- **THEN** report a configuration error including linted file and tsconfig path details
