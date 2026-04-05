## ADDED Requirements

### Requirement: Plugin SHALL expose a minimal config for zero-config symbol fixing

The plugin SHALL export `configs.minimal` containing only `no-special-unicode` and `no-unicode-escape` at error severity. This config requires no additional settings and is safe to add to any project without modification.

#### Scenario: Minimal config enables symbol rules

- **WHEN** a user spreads `unslop.configs.minimal` into their ESLint config
- **THEN** `unslop/no-special-unicode` and `unslop/no-unicode-escape` MUST be enabled at error severity

#### Scenario: Minimal config requires no settings

- **WHEN** `unslop.configs.minimal` is used without any `settings.unslop` block
- **THEN** both enabled rules MUST operate without errors or warnings about missing configuration

### Requirement: Plugin SHALL expose a full config for architecture enforcement

The plugin SHALL export `configs.full` that enables the complete rule suite: `no-special-unicode`, `no-unicode-escape`, `import-control`, `export-control`, and `no-false-sharing`. This config is designed for projects that define `settings.unslop.architecture`.

#### Scenario: Full config enables all rules

- **WHEN** a user spreads `unslop.configs.full` into their ESLint config
- **THEN** all five rules (`no-special-unicode`, `no-unicode-escape`, `import-control`, `export-control`, `no-false-sharing`) MUST be enabled at error severity

#### Scenario: Full config without architecture settings is graceful

- **WHEN** `unslop.configs.full` is used without `settings.unslop.architecture`
- **THEN** `import-control`, `export-control`, and `no-false-sharing` MUST no-op without throwing, while symbol rules remain active

#### Scenario: Full config with architecture settings enforces boundaries

- **WHEN** `unslop.configs.full` is used alongside a valid `settings.unslop.architecture` block
- **THEN** architecture rules MUST enforce module boundaries and shared-module constraints as configured

### Requirement: Plugin SHALL NOT expose a config named recommended

The name `configs.recommended` SHALL NOT exist on the plugin export. Projects previously using `unslop.configs.recommended` MUST migrate to `unslop.configs.minimal`.

#### Scenario: No recommended config export

- **WHEN** a consumer accesses `unslop.configs.recommended`
- **THEN** the value MUST be `undefined`
