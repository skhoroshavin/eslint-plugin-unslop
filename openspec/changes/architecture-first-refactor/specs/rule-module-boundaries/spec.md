## MODIFIED Requirements

### Requirement: Repository self-linting SHALL treat shared areas as directory-based cohesion units

The repository's `unslop/no-false-sharing` configuration for `src/` SHALL be expressed via `shared: true` on the relevant module policies in `settings.unslop.architecture`, not via rule-level options. The rule MUST be enabled without options.

#### Scenario: Evaluating shared utilities under the new structure

- **WHEN** the repository lint configuration checks shared code areas
- **THEN** shared modules (e.g. `utils`) MUST be declared with `shared: true` in `settings.unslop.architecture` and `unslop/no-false-sharing` MUST be enabled without rule-level options
