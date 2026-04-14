## ADDED Requirements

### Requirement: scenario() SHALL support simple and full test scenario shapes

The shared `scenario()` test utility SHALL accept exactly two input structures: a simple scenario with inline `code`, and a full scenario with `files` and `filename`. The utility SHALL convert both shapes to RuleTester-compatible test cases without changing rule execution semantics.

#### Scenario: Simple scenario provides inline source

- **WHEN** a scenario provides `code` and no `files`
- **THEN** the utility runs linting using the provided `code` as the test case source

#### Scenario: Full scenario provides filesystem-backed source

- **WHEN** a scenario provides `files` and `filename`
- **THEN** the utility resolves linted source from the `files` entry whose `path` matches `filename`

### Requirement: scenario() SHALL enforce strict full-scenario fixture validity

For full scenarios, fixture source of truth SHALL be the file list only. The utility MUST reject ambiguous or incomplete full fixtures before invoking RuleTester.

#### Scenario: Full scenario missing filename match fails fast

- **WHEN** no `files` entry path matches the provided `filename`
- **THEN** the utility throws a setup error describing the missing target fixture

#### Scenario: Full scenario target file has no content fails fast

- **WHEN** the matching `files` entry exists but does not define `content`
- **THEN** the utility throws a setup error describing that full scenarios require explicit target content

### Requirement: scenario() SHALL preserve existing optional test controls

Both simple and full scenarios SHALL continue supporting optional fields used by existing tests, including parser mode, settings, expected errors, and output assertions.

#### Scenario: TypeScript parser flag is honored

- **WHEN** a scenario enables `typescript`
- **THEN** RuleTester runs with the TypeScript parser configuration as before

#### Scenario: Settings and autofix assertions are preserved

- **WHEN** a scenario includes `settings` and/or `output`
- **THEN** those values are forwarded unchanged to RuleTester execution

### Requirement: Full scenario migrations SHALL eliminate duplicated lint source declarations

File-backed rule tests SHALL define lint target source only once in `files` content. Top-level duplicated `code` in full scenarios SHALL be removed during migration.

#### Scenario: Migrated full test case uses single source of truth

- **WHEN** a file-backed test case is migrated
- **THEN** its linted source appears only in the target `files` fixture content and not as duplicated top-level `code`
