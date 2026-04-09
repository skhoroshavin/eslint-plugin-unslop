## MODIFIED Requirements

### Requirement: no-false-sharing SHALL evaluate shared entrypoint exports at symbol granularity

`unslop/no-false-sharing` MUST evaluate whether symbols exported from shared module entrypoints (`index.ts` and `types.ts`) are consumed by at least two distinct consumer groups. The rule derives project root from the tsconfig file location and source root from tsconfig compiler options. Alias resolution during consumer scanning uses `compilerOptions.paths` instead of hardcoded `@/`. Consumer analysis MUST count both public entrypoint imports of the symbol and same-shared-module internal usage of the symbol. For re-exported symbols, internal usage MAY resolve through the backing internal file; for direct entrypoint exports, internal usage MAY resolve through the shared entrypoint itself. Boundary-violating imports of internal files from outside the shared module MUST NOT count as consumers.

#### Scenario: Exported symbol has two distinct consumers

- **WHEN** a symbol exported from a shared module entrypoint is imported by at least two distinct consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

#### Scenario: Exported symbol has one consumer group

- **WHEN** a symbol exported from a shared module entrypoint is imported by only one consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

#### Scenario: Consumer uses tsconfig alias to import shared symbol

- **WHEN** a consumer file imports a shared symbol using any alias configured in `compilerOptions.paths` (e.g., `@/shared/utils`, `~/lib/helpers`, `@utils`)
- **THEN** `unslop/no-false-sharing` MUST resolve the alias via the paths matcher and count it as a valid consumer

#### Scenario: Re-exported symbol has an internal shared consumer

- **WHEN** a shared entrypoint re-exports a symbol from an internal file and another file in that same shared module imports the symbol from the internal file
- **THEN** `unslop/no-false-sharing` MUST count that usage toward the exported symbol as one internal consumer group

#### Scenario: Direct entrypoint export has an internal shared consumer

- **WHEN** a file in the same shared module imports a symbol from the shared entrypoint file and that symbol is declared directly in the entrypoint
- **THEN** `unslop/no-false-sharing` MUST count that usage toward the exported symbol as one internal consumer group

#### Scenario: External import of internal backing file does not satisfy sharing

- **WHEN** a file outside the shared module imports a re-exported symbol from its internal backing file instead of the shared entrypoint
- **THEN** `unslop/no-false-sharing` MUST NOT count that usage toward the exported symbol

#### Scenario: No tsconfig found for linted file

- **WHEN** `no-false-sharing` runs on a file with no reachable `tsconfig.json`
- **THEN** the rule MUST become a no-op and NOT report errors for that file
