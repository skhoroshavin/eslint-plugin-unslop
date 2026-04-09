## Purpose

Define how the plugin discovers and uses `tsconfig.json` to derive project layout and resolve local imports.

## ADDED Requirements

### Requirement: Plugin SHALL read tsconfig.json to resolve project layout

The plugin SHALL locate and parse the nearest `tsconfig.json` for each linted file using the `get-tsconfig` library. The resolved tsconfig provides project root, source root, and path alias configuration for all architecture rules.

#### Scenario: tsconfig.json found in file's ancestor directory

- **WHEN** a linted file has a `tsconfig.json` in its directory or any ancestor directory
- **THEN** the plugin MUST use that tsconfig as the configuration source for path resolution

#### Scenario: tsconfig.json not found

- **WHEN** no `tsconfig.json` is found in the file's directory or any ancestor directory
- **THEN** the plugin MUST emit a warning and architecture rules MUST become no-ops for that file

#### Scenario: tsconfig.json uses extends

- **WHEN** a `tsconfig.json` uses `extends` to inherit from a base config
- **THEN** the plugin MUST resolve the full merged configuration including inherited `compilerOptions.paths`, `rootDir`, and `baseUrl`

### Requirement: Plugin SHALL derive project root from tsconfig location

The project root SHALL be the directory containing the resolved `tsconfig.json` file. This replaces the previous approach of string-searching for `/<sourceRoot>/` in absolute file paths.

#### Scenario: Single tsconfig at project root

- **WHEN** `tsconfig.json` is located at `/projects/my-app/tsconfig.json`
- **THEN** the project root MUST be `/projects/my-app`

#### Scenario: Monorepo with per-package tsconfig

- **WHEN** a file at `/monorepo/packages/ui/src/button.ts` has a nearest tsconfig at `/monorepo/packages/ui/tsconfig.json`
- **THEN** the project root for that file MUST be `/monorepo/packages/ui`

### Requirement: Plugin SHALL derive source root from tsconfig compiler options

The source root SHALL be derived from `tsconfig.json` compiler options in the following priority order:

1. `compilerOptions.rootDir` (explicit, normalized relative to project root)
2. Inferred from the first `compilerOptions.paths` target prefix (e.g., `"@/*": ["src/*"]` implies `src`)
3. `compilerOptions.baseUrl` if it is not `.` or the project root
4. No source root (file paths relative to project root are used directly for module matching)

#### Scenario: rootDir is set

- **WHEN** `tsconfig.json` contains `compilerOptions.rootDir` set to `"./src"`
- **THEN** the source root MUST be `src`

#### Scenario: rootDir absent but paths reveal source root

- **WHEN** `tsconfig.json` has no `rootDir` but has `compilerOptions.paths` with `"@/*": ["src/*"]`
- **THEN** the source root MUST be inferred as `src`

#### Scenario: rootDir absent, paths absent, baseUrl is non-trivial

- **WHEN** `tsconfig.json` has no `rootDir`, no `paths`, but `baseUrl` is `"src"`
- **THEN** the source root MUST be inferred as `src`

#### Scenario: rootDir absent, paths absent, baseUrl is project root

- **WHEN** `tsconfig.json` has no `rootDir`, no `paths`, and `baseUrl` is `"."`
- **THEN** the source root MUST be undefined and module matching MUST use file paths relative to project root

#### Scenario: No relevant compiler options set

- **WHEN** `tsconfig.json` has none of `rootDir`, `paths`, or a non-trivial `baseUrl`
- **THEN** the source root MUST be undefined and module matching MUST use file paths relative to project root

### Requirement: Plugin SHALL resolve path aliases from compilerOptions.paths

The plugin SHALL use `get-tsconfig`'s `createPathsMatcher` to resolve import specifiers against `compilerOptions.paths`. When multiple candidate targets exist for a single pattern, only the first candidate SHALL be used.

#### Scenario: Prefix rewrite alias resolves

- **WHEN** `compilerOptions.paths` defines `"@/*": ["src/*"]` and an import specifier is `"@/utils/helpers"`
- **THEN** the plugin MUST resolve it to the absolute path for `<projectRoot>/src/utils/helpers` (with file extension probing)

#### Scenario: Exact match alias resolves

- **WHEN** `compilerOptions.paths` defines `"@config": ["src/config/index"]` and an import specifier is `"@config"`
- **THEN** the plugin MUST resolve it to the absolute path for `<projectRoot>/src/config/index` (with file extension probing)

#### Scenario: Non-alias specifier returns no match

- **WHEN** an import specifier is `"react"` or `"@typescript-eslint/parser"` and is not configured in `compilerOptions.paths`
- **THEN** the plugin MUST treat it as an external package and NOT attempt alias resolution

#### Scenario: No paths configured

- **WHEN** `tsconfig.json` has no `compilerOptions.paths`
- **THEN** the plugin MUST treat all non-relative specifiers as external packages

#### Scenario: Multiple candidate targets for a pattern

- **WHEN** `compilerOptions.paths` defines `"@/*": ["src/*", "generated/*"]` and an import specifier is `"@/models/user"`
- **THEN** the plugin MUST attempt resolution using only the first target (`src/*`) and ignore additional candidates

### Requirement: Plugin SHALL cache tsconfig reads per lint run

The plugin SHALL maintain a module-level cache keyed by resolved tsconfig file path. Each unique tsconfig SHALL be parsed and processed at most once per lint run.

#### Scenario: Multiple files share the same tsconfig

- **WHEN** two files in the same project are linted sequentially
- **THEN** the tsconfig MUST be read and parsed only once, with the cached result reused for the second file

#### Scenario: Monorepo files use different tsconfigs

- **WHEN** files from two different packages in a monorepo are linted
- **THEN** each package's tsconfig MUST be cached independently

### Requirement: Local specifier detection SHALL use paths matcher

A specifier SHALL be considered local if it starts with `.` (relative import) OR if the paths matcher returns a non-empty result for it. This replaces the hardcoded `@/` prefix check.

#### Scenario: Relative import is local

- **WHEN** an import specifier starts with `./` or `../`
- **THEN** it MUST be treated as a local specifier

#### Scenario: Alias import matching paths is local

- **WHEN** an import specifier matches a pattern in `compilerOptions.paths` (e.g., `@/utils` matching `"@/*": ["src/*"]`)
- **THEN** it MUST be treated as a local specifier

#### Scenario: Scoped package not in paths is external

- **WHEN** an import specifier is `@my-org/package` and it is not configured in `compilerOptions.paths`
- **THEN** it MUST be treated as an external specifier

#### Scenario: Bare specifier not in paths is external

- **WHEN** an import specifier is `lodash` and it is not configured in `compilerOptions.paths`
- **THEN** it MUST be treated as an external specifier
