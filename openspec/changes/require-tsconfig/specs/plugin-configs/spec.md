## MODIFIED Requirements

### Requirement: Plugin SHALL expose a full config for architecture and readability enforcement

`configs.full` enables the complete suite: `no-special-unicode`, `no-unicode-escape`, `import-control`, `export-control`, `no-false-sharing`, `read-friendly-order`. It is designed for projects with `settings.unslop.architecture`. For rules that require TypeScript semantic context, missing, invalid, or non-inclusive tsconfig context MUST surface as explicit lint errors instead of silent no-ops.

#### Scenario: Full config enables all rules

- **WHEN** spreading `unslop.configs.full`
- **THEN** all six rules at error severity

#### Scenario: Full config without architecture settings is graceful

- **WHEN** used without `settings.unslop.architecture`
- **THEN** architecture rules no-op, symbol rules remain active

#### Scenario: Full config with architecture settings enforces boundaries

- **WHEN** used with valid `settings.unslop.architecture` and usable tsconfig context
- **THEN** architecture rules enforce boundaries as configured

#### Scenario: Full config with architecture settings and unusable tsconfig fails explicitly

- **WHEN** used with `settings.unslop.architecture` but required tsconfig context cannot be loaded
- **THEN** impacted architecture/semantic rules report configuration errors with actionable path context
