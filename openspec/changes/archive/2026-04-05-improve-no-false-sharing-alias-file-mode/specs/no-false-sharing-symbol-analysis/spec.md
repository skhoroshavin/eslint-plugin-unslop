## ADDED Requirements

### Requirement: no-false-sharing SHALL evaluate shared entrypoint exports at symbol granularity

`unslop/no-false-sharing` MUST evaluate whether symbols exported from shared module entrypoints (`index.ts` and `types.ts`) are consumed by at least two distinct consumer groups.

#### Scenario: Exported symbol has two distinct consumers

- **WHEN** a symbol exported from a shared module entrypoint is imported by at least two distinct consumer groups
- **THEN** `unslop/no-false-sharing` MUST allow that symbol

#### Scenario: Exported symbol has one consumer group

- **WHEN** a symbol exported from a shared module entrypoint is imported by only one consumer group
- **THEN** `unslop/no-false-sharing` MUST report that symbol as not truly shared

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
