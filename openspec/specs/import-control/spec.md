## ADDED Requirements

### Requirement: Architecture policy SHALL be defined in shared ESLint settings

The plugin reads architecture policy from `settings.unslop.architecture`. Module policies are keyed by module matcher and may define `imports`, `exports`, `shared`, and `entrypoints`. `entrypoints` defaults to `['index.ts']` when omitted. Source root is derived from `tsconfig.json`.

#### Scenario: Architecture settings are present

- **WHEN** ESLint evaluates a file with `settings.unslop.architecture` configured
- **THEN** architecture rules MUST use that shared policy

#### Scenario: Architecture settings are missing

- **WHEN** architecture rules run without `settings.unslop.architecture`
- **THEN** rules MUST fail gracefully without throwing

#### Scenario: Configured module omits entrypoints

- **WHEN** a module policy omits `entrypoints`
- **THEN** allowed entrypoints default to `['index.ts']`

### Requirement: Import control SHALL forbid local cross-module namespace imports

`unslop/import-control` MUST reject `import * as X from '...'` when the target resolves to another local module.

#### Scenario: Local cross-module namespace import is rejected

- **WHEN** a file uses `import * as Namespace from '<local-path-or-alias>'`
- **THEN** report an error

#### Scenario: External dependency namespace import is allowed

- **WHEN** a file uses `import * as Namespace from 'package-name'`
- **THEN** no error

### Requirement: Import control SHALL enforce deny-by-default module boundaries

Cross-module imports are forbidden unless the importer explicitly allows the target via `imports` or the import is a shallow relative entrypoint import. Module identity is derived from the TypeScript semantic project. No semantic project means no-op.

#### Scenario: Allowed cross-module edge

- **WHEN** importer policy includes target in `imports`
- **THEN** allow

#### Scenario: Undeclared cross-module edge

- **WHEN** importer policy does not include target in `imports` and it is not a shallow relative entrypoint import
- **THEN** report an error

#### Scenario: Wildcard import allowlist pattern matches explicitly-named sub-module

- **WHEN** `imports` contains `"parent/*"` and target matches `"parent/child"`
- **THEN** allow

#### Scenario: Wildcard import allowlist pattern does not match deeper explicitly-named sub-module

- **WHEN** `imports` contains `"parent/*"` and target matches `"parent/child/sub"`
- **THEN** report an error (`"parent/*"` covers one wildcard segment)

#### Scenario: Unmatched module edge

- **WHEN** a file does not match any module key
- **THEN** treat as anonymous module with empty `imports` policy

#### Scenario: Semantic project unavailable

- **WHEN** no usable TypeScript semantic project exists
- **THEN** no-op

### Requirement: Import control SHALL enforce public-entrypoint-only cross-module imports

Cross-module imports are allowed only to files in the target module's `entrypoints` (default `['index.ts']`). Resolution uses the TypeScript semantic project.

#### Scenario: Cross-module import targets configured entrypoint via explicit policy

- **WHEN** import resolves to a file in target's `entrypoints` and importer allows target
- **THEN** allow

#### Scenario: Cross-module alias import targets configured entrypoint via explicit policy

- **WHEN** alias import resolves to a file in target's `entrypoints` and importer allows target
- **THEN** allow

#### Scenario: Cross-module import to configured module defaults to index entrypoint

- **WHEN** import resolves to `index.ts` in a target that omits `entrypoints`
- **THEN** allow

#### Scenario: Cross-module import targets internal file

- **WHEN** import resolves to a file not in target's `entrypoints`
- **THEN** report an error

#### Scenario: Cross-module import to anonymous module allows only index entrypoint

- **WHEN** target is anonymous and import resolves to `index.ts`
- **THEN** allow

#### Scenario: Cross-module import to anonymous module non-index entrypoint

- **WHEN** target is anonymous and import resolves to a non-`index.ts` file
- **THEN** report an error

### Requirement: Import control SHALL implicitly allow shallow relative imports to direct child entrypoints

A `./`-relative import at most one level deep to an allowed child-module entrypoint is implicitly allowed.

#### Scenario: Shallow relative import to child module configured entrypoint

- **WHEN** `./`-relative import one level deep resolves to child's `entrypoints`
- **THEN** allow regardless of `imports` policy

#### Scenario: Shallow relative import to child module default entrypoint

- **WHEN** `./`-relative import one level deep resolves to `index.ts` in child with no explicit `entrypoints`
- **THEN** allow

#### Scenario: Shallow relative import to child module non-entrypoint

- **WHEN** `./`-relative import resolves to a file not in child's `entrypoints`
- **THEN** apply normal boundary checks

### Requirement: Import control SHALL subsume shallow deep-import behavior within modules

Same-module depth limits based on resolved target identity, regardless of relative or alias syntax.

#### Scenario: Same-module shallow relative import is allowed

- **WHEN** same-module import reaches at most one level deeper
- **THEN** allow

#### Scenario: Same-module deep relative import is rejected

- **WHEN** same-module import reaches two or more levels deeper
- **THEN** report an error

#### Scenario: Same-module deep alias import is rejected

- **WHEN** same-module alias import resolves two or more levels deeper
- **THEN** report an error
