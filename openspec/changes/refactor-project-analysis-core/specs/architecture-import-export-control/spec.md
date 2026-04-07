## ADDED Requirements

### Requirement: Architecture-aware rules SHALL honor project path resolution when project configuration is available

`unslop/import-control` and `unslop/no-false-sharing` MUST resolve local alias and path-based imports according to project TypeScript configuration when project configuration is available for the current file.

#### Scenario: Alias import resolves through tsconfig

- **WHEN** a file is analyzed with project configuration that defines a local alias path and an architecture-aware rule evaluates an import using that alias
- **THEN** the rule MUST use the target resolved from project configuration for boundary enforcement or consumer counting

#### Scenario: Alias not defined in tsconfig does not use plugin-owned shortcut

- **WHEN** a file is analyzed with project configuration and an alias import is not resolvable through that configuration
- **THEN** architecture-aware rules MUST NOT resolve that alias through a built-in `@/` source-root shortcut

#### Scenario: Non-project context keeps existing fallback behavior

- **WHEN** project configuration is unavailable for the current file
- **THEN** architecture-aware rules MUST preserve existing non-project local resolution behavior
