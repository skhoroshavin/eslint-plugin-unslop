## MODIFIED Requirements

### Requirement: Plugin SHALL expose a full config for architecture and readability enforcement

`configs.full` enables the complete suite: `no-special-unicode`, `no-unicode-escape`, `import-control`, `no-whitebox-testing`, `export-control`, `no-false-sharing`, `no-single-use-constants`, and `read-friendly-order`. It is designed for projects with `settings.unslop.architecture`, which SHALL be interpreted through the shared `architecture-config` capability. For rules that require TypeScript semantic context, missing, invalid, non-inclusive tsconfig context, or invalid architecture configuration MUST surface as explicit lint errors instead of silent no-ops.

#### Scenario: Full config enables all rules

- **WHEN** spreading `unslop.configs.full`
- **THEN** all eight rules are enabled at error severity

#### Scenario: Full config without architecture settings is graceful

- **WHEN** used without `settings.unslop.architecture`
- **THEN** architecture rules no-op, symbol rules remain active

#### Scenario: Full config with architecture settings enforces boundaries

- **WHEN** used with valid `settings.unslop.architecture` and usable shared architecture config context
- **THEN** architecture rules enforce boundaries as configured

#### Scenario: Full config with invalid architecture settings fails explicitly

- **WHEN** used with `settings.unslop.architecture` but the shared architecture config contains unsupported key selectors
- **THEN** impacted architecture rules report configuration errors

#### Scenario: Full config with architecture settings and unusable tsconfig fails explicitly

- **WHEN** used with `settings.unslop.architecture` but required tsconfig context cannot be loaded
- **THEN** impacted architecture and semantic rules report configuration errors with actionable path context
