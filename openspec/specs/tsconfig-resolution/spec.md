## Purpose

Define how the plugin discovers and uses `tsconfig.json` to derive project layout and resolve local imports.

## ADDED Requirements

### Requirement: Plugin SHALL read tsconfig.json to resolve project layout

The plugin SHALL locate the nearest `tsconfig.json` for each linted file using TypeScript config discovery APIs and parse it through the TypeScript compiler API. The resolved configuration MUST provide project root, source root, compiler options, and a shared semantic project context that rules can reuse for cross-file analysis.

#### Scenario: tsconfig.json found in file's ancestor directory

- **WHEN** a linted file has a `tsconfig.json` in its directory or any ancestor directory
- **THEN** the plugin MUST use that tsconfig as the configuration source for semantic project analysis

#### Scenario: tsconfig.json not found

- **WHEN** no `tsconfig.json` is found in the file's directory or any ancestor directory
- **THEN** rules that require a semantic project MUST become no-ops for that file

#### Scenario: tsconfig.json uses extends

- **WHEN** a `tsconfig.json` uses `extends` to inherit from a base config
- **THEN** the plugin MUST resolve the full merged configuration including inherited `compilerOptions.paths`, `rootDir`, and `baseUrl`

#### Scenario: File is outside the semantic project

- **WHEN** a linted file has a nearest `tsconfig.json` but is not part of the semantic TypeScript project created from it
- **THEN** rules that require that semantic project MUST become no-ops for that file

### Requirement: Plugin SHALL resolve path aliases from compilerOptions.paths

The plugin SHALL use TypeScript module resolution as the source of truth for local import resolution. `compilerOptions.paths`, `baseUrl`, and related compiler options MUST participate through TypeScript's resolver rather than through a separate paths-matcher implementation.

#### Scenario: Prefix rewrite alias resolves

- **WHEN** `compilerOptions.paths` defines `"@/*": ["src/*"]` and an import specifier is `"@/utils/helpers"`
- **THEN** the plugin MUST resolve it to the absolute path for `<projectRoot>/src/utils/helpers` according to TypeScript module resolution

#### Scenario: Exact match alias resolves

- **WHEN** `compilerOptions.paths` defines `"@config": ["src/config/index"]` and an import specifier is `"@config"`
- **THEN** the plugin MUST resolve it to the absolute path for `<projectRoot>/src/config/index` according to TypeScript module resolution

#### Scenario: Non-alias specifier returns no match

- **WHEN** an import specifier is `"react"` or `"@typescript-eslint/parser"` and TypeScript does not resolve it to a local project file
- **THEN** the plugin MUST treat it as an external package

#### Scenario: No paths configured

- **WHEN** `tsconfig.json` has no `compilerOptions.paths`
- **THEN** the plugin MUST still rely on TypeScript module resolution and MUST treat unresolved bare specifiers as external packages

#### Scenario: Multiple candidate targets for a pattern

- **WHEN** `compilerOptions.paths` defines `"@/*": ["src/*", "generated/*"]` and an import specifier is `"@/models/user"`
- **THEN** the plugin MUST follow the path selected by TypeScript module resolution for that specifier

### Requirement: Plugin SHALL cache tsconfig reads per lint run

The plugin SHALL maintain a module-level cache keyed by resolved tsconfig file path. Each unique tsconfig SHALL create at most one shared semantic project context per lint run, and any rule that needs cross-file TypeScript analysis MUST reuse that cached context.

#### Scenario: Multiple files share the same tsconfig

- **WHEN** two files in the same project are linted sequentially
- **THEN** the plugin MUST reuse the same cached project context for the second file

#### Scenario: Monorepo files use different tsconfigs

- **WHEN** files from two different packages in a monorepo are linted
- **THEN** each package's tsconfig MUST be cached independently

### Requirement: Local specifier detection SHALL use paths matcher

A specifier SHALL be considered local when TypeScript module resolution from the current semantic project resolves it to a file inside that project. This replaces direct paths-matcher inspection while preserving the same local-versus-external outcomes for relative imports, configured aliases, and external packages.

#### Scenario: Relative import is local

- **WHEN** an import specifier starts with `./` or `../` and TypeScript resolves it to a file in the current project
- **THEN** it MUST be treated as a local specifier

#### Scenario: Alias import matching paths is local

- **WHEN** an import specifier matches a pattern in `compilerOptions.paths` (e.g., `@/utils` matching `"@/*": ["src/*"]`) and TypeScript resolves it to a file in the current project
- **THEN** it MUST be treated as a local specifier

#### Scenario: Scoped package not in paths is external

- **WHEN** an import specifier is `@my-org/package` and TypeScript does not resolve it to a file in the current project
- **THEN** it MUST be treated as an external specifier

#### Scenario: Bare specifier not in paths is external

- **WHEN** an import specifier is `lodash` and TypeScript does not resolve it to a file in the current project
- **THEN** it MUST be treated as an external specifier
