## ADDED Requirements

### Requirement: no-single-use-constants SHALL report single-use module constants

`unslop/no-single-use-constants` MUST report a module-scope `const` declaration when its total real usage count across the semantic project is 0 or 1. The rule MUST only analyze declarators whose binding id is a plain identifier, and it MUST report on the `VariableDeclarator` with message id `singleUse` including the constant name and final count.

#### Scenario: Module constant has no real uses

- **WHEN** a module-scope `const` identifier is never read anywhere in the project
- **THEN** `unslop/no-single-use-constants` MUST report that declarator with count `0`

#### Scenario: Module constant has exactly one real use

- **WHEN** a module-scope `const` identifier is read exactly once across the project
- **THEN** `unslop/no-single-use-constants` MUST report that declarator with count `1`

#### Scenario: Module constant has two real uses

- **WHEN** a module-scope `const` identifier is read two or more times across the project
- **THEN** `unslop/no-single-use-constants` MUST NOT report that declarator

### Requirement: no-single-use-constants SHALL exclude non-inlineable declarations and non-uses

`unslop/no-single-use-constants` MUST ignore declarations that are not plain module-scope inlineable constants. The rule MUST skip declarators with destructured ids, declarators initialized with `ArrowFunctionExpression`, `FunctionExpression`, or `ClassExpression`, identifiers that appear only in import or export specifier positions, and bare `export default IDENTIFIER` statements.

### Requirement: no-single-use-constants SHALL NOT report constants initialized with structured data or factory expressions

`unslop/no-single-use-constants` MUST ignore module-scope `const` declarators whose initializer is an `ObjectExpression` or `NewExpression`. These represent named structured data - dispatch tables, configuration objects, or performance-optimized structures such as `new Set([...])` - where the name is not an alias for a trivially inlineable value but is instead a deliberate semantic or performance choice. The rule MUST also ignore declarators whose initializer is a `CallExpression` carrying explicit TypeScript type arguments, as these represent generic factory or builder calls whose results are intentionally cached at module scope.

#### Scenario: Destructured const is ignored

- **WHEN** a module-scope `const` declaration uses an object or array pattern instead of a plain identifier
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator

#### Scenario: Function-valued const is ignored

- **WHEN** a module-scope `const` identifier is initialized with an arrow function or function expression
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator

#### Scenario: Class-valued const is ignored

- **WHEN** a module-scope `const` identifier is initialized with a class expression
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator

#### Scenario: Re-export does not count as a use

- **WHEN** an identifier only appears in `export { FOO }` or `export { FOO as Bar }`
- **THEN** `unslop/no-single-use-constants` MUST NOT count those export specifier occurrences as uses

#### Scenario: Export default identifier does not count as a use

- **WHEN** an identifier only appears in `export default FOO`
- **THEN** `unslop/no-single-use-constants` MUST NOT count that export statement as a use

#### Scenario: Ambient declare const is ignored

- **WHEN** a module-scope `const` declaration has no initializer (i.e., it is a `declare const` ambient type declaration)
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator

#### Scenario: Object literal initializer is ignored

- **WHEN** a module-scope `const` identifier is initialized with an object literal (e.g., a dispatch table, configuration object, or state machine record)
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator regardless of use count

#### Scenario: Array literal initializer is reported when used once

- **WHEN** a module-scope `const` identifier is initialized with an array literal and is read exactly once across the project
- **THEN** `unslop/no-single-use-constants` MUST report that declarator with count `1`

#### Scenario: Constructor call initializer is ignored

- **WHEN** a module-scope `const` identifier is initialized with a `new` expression (e.g., `new Set([...])`, `new Map([...])`)
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator regardless of use count

#### Scenario: Generic factory call initializer is ignored

- **WHEN** a module-scope `const` identifier is initialized with a call expression that carries explicit TypeScript type arguments (e.g., `typia.createValidate<MySchema>()`, `builder.compile<T>()`)
- **THEN** `unslop/no-single-use-constants` MUST ignore that declarator regardless of use count

### Requirement: no-single-use-constants SHALL count project-wide semantic uses

For exported module-scope constants, `unslop/no-single-use-constants` MUST count real uses across all files in the semantic TypeScript project by matching canonical symbol identity. The rule MUST count expression uses in local files and other project files, including uses inside exported expressions such as `export const BAR = FOO`, and it MUST become a no-op when no semantic TypeScript project is available for the linted file.

#### Scenario: Exported constant is used from another file

- **WHEN** an exported module-scope `const` identifier is imported and read from another file in the same semantic project
- **THEN** `unslop/no-single-use-constants` MUST include that read in the total usage count

#### Scenario: Exported expression use counts

- **WHEN** a constant identifier appears in an exported value expression such as `export const BAR = FOO`
- **THEN** `unslop/no-single-use-constants` MUST count that identifier occurrence as a real use

#### Scenario: Import declaration does not count as a use

- **WHEN** an identifier only appears in `import { FOO } from '...'` or `import FOO from '...'`
- **THEN** `unslop/no-single-use-constants` MUST NOT count those import positions as uses

#### Scenario: Semantic project unavailable

- **WHEN** the rule cannot create or access a semantic TypeScript project for the linted file
- **THEN** `unslop/no-single-use-constants` MUST become a no-op and report nothing for that file
