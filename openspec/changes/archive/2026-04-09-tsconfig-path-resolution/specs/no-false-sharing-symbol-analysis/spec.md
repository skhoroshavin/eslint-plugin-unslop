## MODIFIED Requirements

### Requirement: no-false-sharing SHALL evaluate shared entrypoint exports at symbol granularity

`unslop/no-false-sharing` MUST evaluate whether symbols exported from shared module entrypoints (`index.ts` and `types.ts`) are consumed by at least two distinct consumer groups. The rule derives project root from the tsconfig file location and source root from tsconfig compiler options. Alias resolution during consumer scanning uses `compilerOptions.paths` instead of hardcoded `@/`.

#### Scenario: Exported symbol has two distinct consumers

- **WHEN** a symbol exported from a shared module entrypoint is imported by at least two distinct consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

#### Scenario: Exported symbol has one consumer group

- **WHEN** a symbol exported from a shared module entrypoint is imported by only one consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

#### Scenario: Consumer uses tsconfig alias to import shared symbol

- **WHEN** a consumer file imports a shared symbol using any alias configured in `compilerOptions.paths` (e.g., `@/shared/utils`, `~/lib/helpers`, `@utils`)
- **THEN** `unslop/no-false-sharing` MUST resolve the alias via the paths matcher and count it as a valid consumer

#### Scenario: No tsconfig found for linted file

- **WHEN** `no-false-sharing` runs on a file with no reachable `tsconfig.json`
- **THEN** the rule MUST become a no-op and NOT report errors for that file
