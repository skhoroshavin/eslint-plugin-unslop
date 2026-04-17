## Purpose

Defines ordering and autofix behavior enforced by `unslop/read-friendly-order`.

## Requirements

### Requirement: Read-friendly-order exposes canonical autofix

The rule SHALL declare code autofix support. Reorder fixes SHALL be deterministic by using top-level public-surface-first bands, while preserving consumer-first ordering within each band when fix-safe and not excluded by eager runtime reachability.

#### Scenario: Top-level canonical output uses explicit bands

- **WHEN** a file has reorderable top-level statements and the region is fix-safe
- **THEN** canonical order: imports, then external re-exports, then local public API, then private declarations

#### Scenario: External re-exports stay above local public exports

- **WHEN** a file contains both external re-exports and local public exports
- **THEN** external re-exports placed after imports, before local public API

#### Scenario: Local export default is prioritized in local public API band

- **WHEN** a file contains a local `export default` in a fix-safe region
- **THEN** placed as high as possible unless eager initialization constrains

#### Scenario: Consumer-first ordering applies within each band

- **WHEN** two symbols in the same band have a dependency relationship
- **THEN** consuming symbol ordered above consumed

#### Scenario: Deterministic class-member reorder output

- **WHEN** a class has constructor/field/dependency-order violations and passes safety checks
- **THEN** canonical single-pass replacement for class members

#### Scenario: Deterministic test-phase reorder output

- **WHEN** a test file has setup/teardown/test-call ordering violations and passes safety checks
- **THEN** canonical replacement: setup hooks before teardown hooks and test calls

### Requirement: Autofix is safety-guarded and non-destructive

The rule MUST avoid fixes when safe reconstruction cannot be guaranteed. Eager-excluded symbols MUST be skipped entirely.

#### Scenario: Ambiguous region does not receive autofix

- **WHEN** ambiguous comment/trivia ownership or unsupported syntax
- **THEN** diagnostic but no fix

#### Scenario: Cyclic dependency groups do not force unsafe moves

- **WHEN** dependency analysis identifies a cycle
- **THEN** no arbitrary cycle-breaking

#### Scenario: Eager call-path dependency is excluded

- **WHEN** a top-level symbol is used through eager module initialization call path
- **THEN** no diagnostic, no fix

### Requirement: Autofix behavior is idempotent under repeated fixing

Repeated fix runs SHALL produce stable output.

#### Scenario: Re-running fix produces no additional edits

- **WHEN** `eslint --fix` on already-fixed code
- **THEN** no further edits
