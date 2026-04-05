## MODIFIED Requirements

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
