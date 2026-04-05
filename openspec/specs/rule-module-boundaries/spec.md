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

The repository SHALL define architecture boundary rules through `eslint-plugin-unslop` using a shared policy at `settings.unslop.architecture`. The policy SHALL use readable module-keyed `imports` allowlists and optional `exports` contracts to describe allowed dependencies and public APIs for plugin entrypoint, rule registry, rule implementation files, rule tests, and utility files under `src/utils`. Any undeclared dependency edge affecting these areas MUST fail validation.

#### Scenario: Declared allowed import

- **WHEN** a file imports a dependency edge that is listed in the import-control allowlist for its module
- **THEN** architecture validation MUST allow the import

#### Scenario: Undeclared import edge

- **WHEN** a file imports a dependency edge that is not listed in the import-control allowlist for its module
- **THEN** architecture validation MUST fail

#### Scenario: Cross-module import bypasses public entrypoint

- **WHEN** a file imports another module through a non-entrypoint file
- **THEN** architecture validation MUST fail

#### Scenario: Utility file imports from a rule module

- **WHEN** a file under `src/utils/` imports from `src/rules/`
- **THEN** architecture validation MUST fail

#### Scenario: Module policy is human-readable

- **WHEN** architecture policy is defined in ESLint settings
- **THEN** module keys and their `imports` / `exports` clauses MUST remain readable without inversion-style deny exceptions

### Requirement: Architecture validation SHALL be wired through existing repository scripts

The repository SHALL run architecture validation as part of existing lint/verification scripts by executing ESLint with architecture rules enabled, without adding standalone helper scripts solely for architecture checks.

#### Scenario: Running repository verification

- **WHEN** `npm run verify` is executed
- **THEN** architecture validation MUST run as part of that script through ESLint rule execution

### Requirement: Repository self-linting SHALL treat shared areas as directory-based cohesion units

The repository's `unslop/no-false-sharing` configuration for `src/` SHALL be expressed via `shared: true` on the relevant module policies in `settings.unslop.architecture`, not via rule-level options. The rule MUST be enabled without options.

#### Scenario: Evaluating shared utilities under the new structure

- **WHEN** the repository lint configuration checks shared code areas
- **THEN** shared modules (e.g. `utils`) MUST be declared with `shared: true` in `settings.unslop.architecture` and `unslop/no-false-sharing` MUST be enabled without rule-level options
