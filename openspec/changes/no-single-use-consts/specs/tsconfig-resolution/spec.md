## MODIFIED Requirements

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

### Requirement: Plugin SHALL cache tsconfig reads per lint run

The plugin SHALL maintain a module-level cache keyed by resolved tsconfig file path. Each unique tsconfig SHALL create at most one shared semantic project context per lint run, and any rule that needs cross-file TypeScript analysis MUST reuse that cached context.

#### Scenario: Multiple files share the same tsconfig

- **WHEN** two files in the same project are linted sequentially
- **THEN** the plugin MUST reuse the same cached project context for the second file

#### Scenario: Monorepo files use different tsconfigs

- **WHEN** files from two different packages in a monorepo are linted
- **THEN** each package's tsconfig MUST be cached independently
