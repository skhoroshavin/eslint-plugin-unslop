## ADDED Requirements

### Requirement: Plugin SHALL expose a minimal config for zero-config symbol fixing

`configs.minimal` enables only `no-special-unicode` and `no-unicode-escape` at error severity. No additional settings required.

#### Scenario: Minimal config enables symbol rules

- **WHEN** spreading `unslop.configs.minimal`
- **THEN** both rules at error severity

#### Scenario: Minimal config requires no settings

- **WHEN** used without `settings.unslop`
- **THEN** both rules operate without errors

### Requirement: Plugin SHALL expose a full config for architecture and readability enforcement

`configs.full` enables the complete suite: `no-special-unicode`, `no-unicode-escape`, `import-control`, `export-control`, `no-false-sharing`, `read-friendly-order`. Designed for projects with `settings.unslop.architecture`.

#### Scenario: Full config enables all rules

- **WHEN** spreading `unslop.configs.full`
- **THEN** all six rules at error severity

#### Scenario: Full config without architecture settings is graceful

- **WHEN** used without `settings.unslop.architecture`
- **THEN** architecture rules no-op, symbol rules remain active

#### Scenario: Full config with architecture settings enforces boundaries

- **WHEN** used with valid `settings.unslop.architecture`
- **THEN** architecture rules enforce boundaries as configured

### Requirement: Plugin SHALL NOT expose a config named recommended

`configs.recommended` SHALL NOT exist.

#### Scenario: No recommended config export

- **WHEN** accessing `unslop.configs.recommended`
- **THEN** value is `undefined`
