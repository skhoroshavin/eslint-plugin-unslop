## MODIFIED Requirements

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
