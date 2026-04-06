## ADDED Requirements

### Requirement: Read-friendly-order exposes canonical autofix

The `read-friendly-order` rule SHALL declare code autofix support and SHALL emit deterministic reorder fixes for existing reordering diagnostics using top-level public-surface-first bands, while preserving consumer-first ordering within each band when a target region is fix-safe and not excluded by eager runtime reachability.

#### Scenario: Top-level canonical output uses explicit bands

- **WHEN** a file contains reorderable top-level statements covered by `read-friendly-order` diagnostics and the region is fix-safe
- **THEN** the canonical order MUST be: imports, then external re-exports, then local public API declarations/exports, then private declarations/helpers/constants/types

#### Scenario: External re-exports stay above local public exports

- **WHEN** a file contains both external re-exports (`export ... from ...`, including wildcard form) and local public exports
- **THEN** the rule MUST place external re-exports immediately after imports and before local public API exports

#### Scenario: Local export default is prioritized in local public API band

- **WHEN** a file contains a local `export default` and other local public exports in a fix-safe region
- **THEN** the rule MUST place the local `export default` as high as possible within the local public API band unless eager initialization constraints require preserving runtime safety

#### Scenario: Consumer-first ordering applies within each band

- **WHEN** two symbols in the same top-level band have a dependency relationship detectable by existing local dependency analysis
- **THEN** the consuming symbol MUST be ordered above the symbol it consumes

#### Scenario: Deterministic class-member reorder output

- **WHEN** a class has constructor, public field, or dependency-order violations covered by existing diagnostics and the class region passes safety checks
- **THEN** the rule emits a canonical single-pass replacement for the class members that resolves those violations

#### Scenario: Deterministic test-phase reorder output

- **WHEN** a test file has setup, teardown, and test-call ordering violations covered by existing diagnostics and the region passes safety checks
- **THEN** the rule emits a canonical single-pass replacement that orders setup hooks before teardown hooks and test calls

### Requirement: Autofix is safety-guarded and non-destructive

The rule MUST avoid applying reordering fixes when safe reconstruction cannot be guaranteed, and SHALL continue reporting diagnostics without a fix in those cases, except for eager-excluded top-level symbols that SHALL be skipped entirely.

#### Scenario: Ambiguous region does not receive autofix

- **WHEN** a reported region has ambiguous comment/trivia ownership or unsupported syntax that makes node movement unsafe
- **THEN** the rule reports the existing diagnostic but emits no autofix for that region

#### Scenario: Cyclic dependency groups do not force unsafe moves

- **WHEN** helper or member dependency analysis identifies a cycle that prevents strict ordering
- **THEN** the rule does not apply an arbitrary cycle-breaking reorder fix

#### Scenario: Eager call-path dependency is excluded

- **WHEN** a top-level helper or constant is used through a transitive call path rooted in eager module initialization code
- **THEN** the rule emits no top-level ordering diagnostic and emits no reorder fix for that symbol

### Requirement: Autofix behavior is idempotent under repeated fixing

The canonical reorder strategy SHALL be idempotent so repeated fix runs produce stable output once a file reaches canonical order.

#### Scenario: Re-running fix produces no additional edits

- **WHEN** `eslint --fix` is executed on code already produced by `read-friendly-order` autofix
- **THEN** the rule emits no further text edits for unchanged input
