## ADDED Requirements

### Requirement: Read-friendly-order exposes canonical autofix

The `read-friendly-order` rule SHALL declare code autofix support and SHALL emit deterministic reorder fixes for all existing reordering diagnostics when a target region is fix-safe and not excluded by eager runtime reachability.

#### Scenario: Deterministic top-level reorder output

- **WHEN** a file has reorderable top-level helper or constant declarations that violate existing `read-friendly-order` diagnostics, the region passes safety checks, and the symbol is not eagerly reachable from module initialization
- **THEN** the rule emits a canonical single-pass replacement for the region that resolves the reported ordering violations

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
