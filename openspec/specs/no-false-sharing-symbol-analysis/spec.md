## ADDED Requirements

### Requirement: no-false-sharing SHALL evaluate shared entrypoint exports at symbol granularity

`unslop/no-false-sharing` MUST evaluate whether symbols exported from shared module entrypoints (`index.ts` and `types.ts`) are consumed by at least two distinct consumer groups. Export discovery and consumer matching MUST use a TypeScript semantic project for the linted file, and symbol comparisons MUST resolve aliases and re-exports to canonical TypeScript symbol identity. Consumer analysis MUST count both public entrypoint imports of the symbol and same-shared-module internal usage of the symbol. For re-exported symbols, internal usage MAY resolve through the backing internal file; for direct entrypoint exports, internal usage MAY resolve through the shared entrypoint itself. Boundary-violating imports of internal files from outside the shared module MUST NOT count as consumers. If a semantic project cannot be created for the linted file, the rule MUST become a no-op.

#### Scenario: Exported symbol has two distinct consumers

- **WHEN** a symbol exported from a shared module entrypoint is imported by at least two distinct consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

#### Scenario: Exported symbol has one consumer group

- **WHEN** a symbol exported from a shared module entrypoint is imported by only one consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

#### Scenario: Consumer uses tsconfig alias to import shared symbol

- **WHEN** a consumer file imports a shared symbol using any alias configured in `compilerOptions.paths` (e.g., `@/shared/utils`, `~/lib/helpers`, `@utils`)
- **THEN** `unslop/no-false-sharing` MUST resolve that import through the TypeScript semantic project and count it as a valid consumer of the canonical exported symbol

#### Scenario: Re-exported symbol has an internal shared consumer

- **WHEN** a shared entrypoint re-exports a symbol from an internal file and another file in that same shared module imports the symbol from the internal file
- **THEN** `unslop/no-false-sharing` MUST count that usage toward the exported symbol as one internal consumer group

#### Scenario: Direct entrypoint export has an internal shared consumer

- **WHEN** a file in the same shared module imports a symbol from the shared entrypoint file and that symbol is declared directly in the entrypoint
- **THEN** `unslop/no-false-sharing` MUST count that usage toward the exported symbol as one internal consumer group

#### Scenario: External import of internal backing file does not satisfy sharing

- **WHEN** a file outside the shared module imports a re-exported symbol from its internal backing file instead of the shared entrypoint
- **THEN** `unslop/no-false-sharing` MUST NOT count that usage toward the exported symbol

#### Scenario: Semantic project unavailable for linted file

- **WHEN** `no-false-sharing` runs on a file without a usable TypeScript semantic project
- **THEN** the rule MUST become a no-op and NOT report errors for that file

### Requirement: no-false-sharing SHALL report symbol-level consumer context

When `unslop/no-false-sharing` reports a symbol, diagnostics MUST include the symbol name and consumer context to make ownership migration explicit.

#### Scenario: Single-consumer symbol report includes consumer group

- **WHEN** a reported symbol has exactly one consumer group
- **THEN** the diagnostic MUST include the symbol name, consumer count, and that consumer group identity

#### Scenario: Zero-consumer symbol report indicates no consumers

- **WHEN** a reported symbol has zero consumers
- **THEN** the diagnostic MUST include the symbol name and indicate that no consumers were found

### Requirement: no-false-sharing SHALL count type-only imports as consumers

Type-only imports are part of shared API usage and MUST be counted by `unslop/no-false-sharing` when determining whether an exported symbol is truly shared.

#### Scenario: Type-only imports satisfy sharing threshold

- **WHEN** an exported type symbol is imported through `import type` by two or more distinct consumer groups
- **THEN** `unslop/no-false-sharing` MUST treat those imports as valid consumers and allow the symbol
