## ADDED Requirements

### Requirement: Rules SHALL use a single public entrypoint

The repository SHALL place each ESLint rule in its own folder under `src/rules/<rule>/`. Each rule folder SHALL expose a public `index.ts` entrypoint that is the import target used by the rule registry and rule tests.

#### Scenario: Registering rules in the central registry

- **WHEN** `src/rules/index.ts` imports a rule module
- **THEN** it MUST import `src/rules/<rule>/index.ts`

#### Scenario: Implementing a small rule

- **WHEN** a rule's implementation is small enough to fit naturally in one file
- **THEN** the rule implementation MAY live directly in `src/rules/<rule>/index.ts`

### Requirement: Rule implementation files SHALL stay within their module boundary

Non-test files inside `src/rules/<rule>/` MUST only import from the same rule folder, approved shared utilities under `src/utils/`, Node built-ins, or external packages. They MUST NOT import files from another rule folder.

#### Scenario: Using shared utilities

- **WHEN** a rule implementation needs reusable repository helpers
- **THEN** it MAY import them from `src/utils/`

#### Scenario: Attempting a cross-rule import

- **WHEN** a non-test file in `src/rules/<rule>/` imports from `src/rules/<other-rule>/`
- **THEN** the architecture validation MUST fail

### Requirement: Rule tests SHALL exercise rules through their public entrypoint

Test files inside `src/rules/<rule>/` MUST treat the rule as a black-box module. They MUST import the rule through `src/rules/<rule>/index.ts` and MAY import only approved shared test utilities outside the rule folder.

#### Scenario: Importing a rule in a test

- **WHEN** a test under `src/rules/<rule>/` needs the rule module
- **THEN** it MUST import `src/rules/<rule>/index.ts`

#### Scenario: Importing a private helper in a test

- **WHEN** a test under `src/rules/<rule>/` imports a sibling helper such as `analysis.ts` or `fixer-utils.ts`
- **THEN** the architecture validation MUST fail

### Requirement: Architecture boundaries SHALL be enforced by an allowlist-style dependency policy

The repository SHALL define dependency-cruiser rules as readable allowlists that describe the allowed dependencies for the rule registry, rule implementation files, and rule tests. Any undeclared dependency edge affecting these areas MUST fail validation.

#### Scenario: Declared allowed import

- **WHEN** a file imports a dependency that is listed in its allowlist zone
- **THEN** architecture validation MUST allow the import

#### Scenario: Undeclared import edge

- **WHEN** a file imports a dependency that is not listed in its allowlist zone
- **THEN** architecture validation MUST fail

### Requirement: Repository self-linting SHALL treat shared areas as directory-based cohesion units

The repository's `unslop/no-false-sharing` configuration for `src/` SHALL evaluate designated shared areas in directory mode so the lint rule aligns with the folder-based architecture.

#### Scenario: Evaluating shared utilities under the new structure

- **WHEN** the repository lint configuration checks shared code areas
- **THEN** it MUST configure `unslop/no-false-sharing` with directory mode for those areas
