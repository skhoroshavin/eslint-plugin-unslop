## Purpose

Defines the shared architecture configuration semantics used by architecture-aware rules.

## Requirements

### Requirement: Architecture config SHALL be defined in shared ESLint settings

The plugin SHALL read architecture policy from `settings.unslop.architecture`. Policies are keyed by architecture key selectors and may define `imports`, `exports`, `shared`, and `entrypoints`. `entrypoints` SHALL default to `['index.ts']` when omitted. Source root SHALL be derived from the discovered `tsconfig.json`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture-aware rules MUST use that shared policy

#### Scenario: Architecture settings are absent

- **WHEN** architecture-aware rules run without `settings.unslop.architecture`
- **THEN** they MUST apply anonymous module defaults to all files

#### Scenario: Configured module omits entrypoints

- **WHEN** a module policy omits `entrypoints`
- **THEN** allowed entrypoints MUST default to `['index.ts']`

### Requirement: Architecture config SHALL derive canonical module paths from containing directories

Each analyzed file SHALL resolve to a canonical module path equal to its containing directory relative to the source root. Source-root files SHALL use the canonical module path `.`. Canonical module paths MUST be configuration-independent.

#### Scenario: Source-root file resolves to root module

- **WHEN** the analyzed file is `src/index.ts`
- **THEN** its canonical module path is `.`

#### Scenario: Nested file resolves to containing directory

- **WHEN** the analyzed file is `src/models/a/index.ts`
- **THEN** its canonical module path is `models/a`

#### Scenario: Deep internal file resolves to its own containing directory

- **WHEN** the analyzed file is `src/models/a/internal/x.ts`
- **THEN** its canonical module path is `models/a/internal`

### Requirement: Architecture keys SHALL assign policy to the nearest owning subtree

Architecture keys SHALL be directory-shaped subtree selectors. An exact key such as `foo` SHALL own `foo` and all descendants under `foo`. A child wildcard key such as `foo/*` SHALL own each direct child subtree under `foo`, including deeper descendants inside each child subtree. When multiple keys cover the same canonical module path, the winning policy SHALL be chosen by nearest owner first, then exact named path over wildcard path at the same depth, then longer selector path, then declaration order.

#### Scenario: Exact key owns its subtree

- **WHEN** the canonical module path is `models`
- **THEN** the key `models` owns that module path and its descendants unless a more specific key overrides it

#### Scenario: Child wildcard key owns direct child subtree

- **WHEN** the canonical module path is `models/a/internal`
- **THEN** the key `models/*` covers that path via child `a`

#### Scenario: Exact child key overrides child wildcard key

- **WHEN** the canonical module path is `models/a/internal` and both `models/*` and `models/a` are configured
- **THEN** `models/a` wins

#### Scenario: Child wildcard key overrides parent exact key for another child subtree

- **WHEN** the canonical module path is `models/b` and both `models` and `models/*` are configured
- **THEN** `models/*` wins

#### Scenario: Child wildcard key does not own the parent module

- **WHEN** the canonical module path is `models` and the only matching configured child selector is `models/*`
- **THEN** `models/*` does not match `models`

### Requirement: Architecture keys SHALL use only supported directory-shaped selector forms

Architecture keys SHALL support only exact canonical module paths such as `.`, `models`, or `ui/views/job-search`, and terminal child wildcard selectors such as `models/*`. Architecture keys MUST NOT be file-shaped and MUST NOT use unsupported wildcard syntax such as `+` or `**`. When unsupported architecture key selectors are present, architecture-aware rules MUST report a configuration error instead of silently interpreting them.

#### Scenario: Root module key is supported

- **WHEN** `settings.unslop.architecture` contains the key `.`
- **THEN** architecture-aware rules treat `.` as the source-root module selector

#### Scenario: File-shaped key is rejected

- **WHEN** `settings.unslop.architecture` contains the key `index.ts`
- **THEN** architecture-aware rules report a configuration error

#### Scenario: Nested file-shaped key is rejected

- **WHEN** `settings.unslop.architecture` contains the key `rules/public.ts`
- **THEN** architecture-aware rules report a configuration error

#### Scenario: Key selector with plus syntax is rejected

- **WHEN** `settings.unslop.architecture` contains the key `models/+`
- **THEN** architecture-aware rules report a configuration error

#### Scenario: Key selector with recursive wildcard is rejected

- **WHEN** `settings.unslop.architecture` contains the key `models/**`
- **THEN** architecture-aware rules report a configuration error

### Requirement: Architecture config SHALL preserve anonymous modules for unmatched canonical module paths

When no configured architecture key owns a canonical module path, the plugin SHALL treat that path as an anonymous module. Anonymous modules SHALL have empty `imports`, empty `exports`, `shared: false`, and default `entrypoints` of `['index.ts']`.

#### Scenario: Unmatched canonical module path becomes anonymous module

- **WHEN** a file resolves to the canonical module path `unknown/public` and no configured architecture key owns that path
- **THEN** that path is treated as an anonymous module

#### Scenario: Anonymous module uses default policy values

- **WHEN** a file belongs to an anonymous module
- **THEN** the effective module policy uses empty `imports`, empty `exports`, `shared: false`, and `entrypoints: ['index.ts']`
