## Purpose

Define the shared project analysis context used by architecture-aware rules.

## ADDED Requirements

### Requirement: Architecture-aware rules SHALL use a shared project context

The plugin SHALL provide a shared project context for architecture-aware rules that centralizes project-backed local path resolution and source-file access needed by those rules.

#### Scenario: import-control resolves a local edge through the shared context

- **WHEN** `unslop/import-control` evaluates a local import or re-export
- **THEN** it MUST resolve the local specifier through the shared project context instead of rule-local resolution logic

#### Scenario: no-false-sharing reads imports through the shared context

- **WHEN** `unslop/no-false-sharing` scans project files for consumers of a shared entrypoint
- **THEN** it MUST obtain source files and import declarations through the shared project context instead of regex-based file parsing

### Requirement: Project context SHALL expose focused project operations

The shared project context MUST expose a small set of reusable operations for local module resolution and project file access, without embedding rule-specific boundary or consumer-group policy.

#### Scenario: Rule requests local resolution

- **WHEN** an architecture-aware rule needs to resolve a local module specifier from an importer file
- **THEN** the project context MUST return the resolved local target path or indicate that the specifier is not resolvable as a local project file

#### Scenario: Rule requests project source access

- **WHEN** an architecture-aware rule needs source files or import declarations for a project file
- **THEN** the project context MUST provide that access without requiring the rule to create its own project or file-scanning pipeline
