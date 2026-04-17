## Purpose

Defines when `unslop/no-single-use-constants` reports module-level constants.

## Requirements

### Requirement: no-single-use-constants SHALL report single-use module constants

The rule SHALL report a module-scope `const` declaration when its total real usage count across the semantic project is 0 or 1. Only plain identifier bindings SHALL be eligible. Reports SHALL target `VariableDeclarator` with message id `singleUse`.

#### Scenario: Module constant has no real uses

- **WHEN** a module-scope `const` identifier has zero reads
- **THEN** report with count `0`

#### Scenario: Module constant has exactly one real use

- **WHEN** read exactly once
- **THEN** report with count `1`

#### Scenario: Module constant has two real uses

- **WHEN** read two or more times
- **THEN** not reported

### Requirement: no-single-use-constants SHALL exclude non-inlineable declarations and non-uses

The rule MUST skip destructured ids, arrow/function/class expressions, import/export specifier positions, and bare `export default IDENTIFIER`.

#### Scenario: Import and export specifier positions are ignored

- **WHEN** an identifier appears only in `import { FOO }` or `export { FOO }` positions
- **THEN** it is not counted as a real use

### Requirement: no-single-use-constants SHALL NOT report constants initialized with structured data or factory expressions

The rule MUST ignore `ObjectExpression` and `NewExpression` initializers. The rule MUST also ignore `CallExpression` with explicit TypeScript type arguments.

#### Scenario: Destructured const is ignored

- **WHEN** binding uses object or array pattern
- **THEN** ignored

#### Scenario: Function-valued const is ignored

- **WHEN** initialized with arrow function or function expression
- **THEN** ignored

#### Scenario: Class-valued const is ignored

- **WHEN** initialized with class expression
- **THEN** ignored

#### Scenario: Re-export does not count as a use

- **WHEN** identifier only appears in `export { FOO }` or `export { FOO as Bar }`
- **THEN** not counted

#### Scenario: Export default identifier does not count as a use

- **WHEN** identifier only appears in `export default FOO`
- **THEN** not counted

#### Scenario: Ambient declare const is ignored

- **WHEN** a `const` declaration has no initializer (`declare const`)
- **THEN** ignored

#### Scenario: Object literal initializer is ignored

- **WHEN** initialized with an object literal
- **THEN** ignored regardless of use count

#### Scenario: Array literal initializer is reported when used once

- **WHEN** initialized with array literal and read once
- **THEN** report with count `1`

#### Scenario: Constructor call initializer is ignored

- **WHEN** initialized with `new` expression (e.g., `new Set(...)`)
- **THEN** ignored

#### Scenario: Generic factory call initializer is ignored

- **WHEN** initialized with a call expression carrying TypeScript type arguments (e.g., `typia.createValidate<MySchema>()`)
- **THEN** ignored

### Requirement: no-single-use-constants SHALL count project-wide semantic uses

For exported constants, count uses across all files in the semantic TypeScript project by canonical symbol identity. If semantic project context cannot be created for the linted file, the rule MUST report a configuration error instead of no-op behavior.

#### Scenario: Exported constant is used from another file

- **WHEN** imported and read from another file
- **THEN** included in count

#### Scenario: Exported expression use counts

- **WHEN** `export const BAR = FOO` references FOO
- **THEN** FOO counted as a use

#### Scenario: Import declaration does not count as a use

- **WHEN** identifier only appears in `import { FOO } from '...'`
- **THEN** not counted

#### Scenario: Semantic project unavailable

- **WHEN** no semantic TypeScript project available
- **THEN** report a configuration error with actionable path context

#### Scenario: File is outside discovered tsconfig project

- **WHEN** a tsconfig is discovered but the linted file is not included by that project
- **THEN** report a configuration error including linted file and tsconfig path details
