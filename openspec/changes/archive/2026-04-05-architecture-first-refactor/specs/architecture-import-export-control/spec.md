## MODIFIED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

The plugin SHALL read architecture policy from `settings.unslop.architecture`, where module policies are keyed by module matcher and each module MAY define `imports`, `exports`, and `shared`. A module with `shared: true` is subject to false-sharing enforcement by `unslop/no-false-sharing`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture rules MUST use that shared policy as their configuration source

#### Scenario: Architecture settings are missing

- **WHEN** architecture rules run without `settings.unslop.architecture`
- **THEN** rules MUST fail gracefully without throwing

#### Scenario: Module marked shared is subject to false-sharing enforcement

- **WHEN** a module policy includes `shared: true` in `settings.unslop.architecture`
- **THEN** `unslop/no-false-sharing` MUST enforce that files within that module are imported by at least two distinct directory-level consumers

#### Scenario: Module not marked shared is exempt from false-sharing enforcement

- **WHEN** a module policy does not include `shared: true`
- **THEN** `unslop/no-false-sharing` MUST NOT report errors for files within that module

## ADDED Requirements

### Requirement: no-false-sharing SHALL derive project root from sourceRoot path

`unslop/no-false-sharing` MUST derive the project root by locating the `sourceRoot` segment in the absolute filename path and taking the prefix before it. This is consistent with how `import-control` and `export-control` resolve paths.

#### Scenario: sourceRoot present in filename

- **WHEN** `settings.unslop.sourceRoot` is set and the filename contains `/<sourceRoot>/`
- **THEN** `no-false-sharing` MUST derive the project root as everything before `/<sourceRoot>/` in the filename

#### Scenario: sourceRoot absent

- **WHEN** `settings.unslop.sourceRoot` is not set
- **THEN** `no-false-sharing` MUST fail gracefully and not report errors for the file

### Requirement: no-false-sharing SHALL take no rule-level options

`unslop/no-false-sharing` MUST declare an empty options schema (`schema: []`). All configuration comes from `settings.unslop.architecture`. Rule-level options are not supported.

#### Scenario: Rule configured without options

- **WHEN** `unslop/no-false-sharing` is enabled as `'error'` with no options
- **THEN** it MUST read shared module configuration from `settings.unslop.architecture`

### Requirement: no-false-sharing SHALL count consumers in directory mode only

`unslop/no-false-sharing` MUST count distinct consumers at the directory level (first path segment relative to project root). File-level consumer counting is not supported.

#### Scenario: Two importers in the same directory

- **WHEN** a shared file is imported by two files in the same directory
- **THEN** `no-false-sharing` MUST report an error (only one directory-level consumer)

#### Scenario: Two importers in different directories

- **WHEN** a shared file is imported by files in at least two distinct directories
- **THEN** `no-false-sharing` MUST allow the file

## REMOVED Requirements

### Requirement: no-false-sharing dirs option configures shared directories

**Reason**: Replaced by `shared: true` on module policies in `settings.unslop.architecture`. Rule-level options are removed to unify all architecture configuration in a single location.

**Migration**: Remove `'unslop/no-false-sharing': ['error', { dirs: [...] }]` from rule configuration. Instead, add `shared: true` to the relevant module policies in `settings.unslop.architecture`, then enable the rule as `'unslop/no-false-sharing': 'error'`.

### Requirement: no-false-sharing supports file-level consumer counting via mode option

**Reason**: File mode is removed. The plugin enforces barrel exports via `export-control`, so all imports from a shared module arrive through its `index.ts`. Under that constraint, two files in the same directory importing a shared module are indistinguishable at the file level — making file mode meaningless. Directory mode is the correct and sufficient granularity.

**Migration**: Remove `mode: 'file'` from any `no-false-sharing` configuration. Migrate to directory mode. With barrel exports enforced, the behavioral difference only arises when two files in the same directory both import a shared module directly — a pattern that `export-control` prevents anyway.
