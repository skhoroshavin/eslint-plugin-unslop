## Purpose

Define the repository's required structure and conventions for rule tests.

## ADDED Requirements

### Requirement: Rule tests SHALL be end-to-end

All tests in this repository SHALL exercise a rule through the public `RuleTester` interface. Tests SHALL treat the rule as a black box and SHALL NOT reach into rule internals or test helper functions directly.

#### Scenario: Verifying rule behavior

- **WHEN** a test is added for an ESLint rule
- **THEN** it MUST exercise the rule through `RuleTester`
- **AND** it MUST import the rule from that rule folder's public `index.ts` entrypoint

#### Scenario: Internal helper behavior matters

- **WHEN** a helper's behavior is important to repository behavior
- **THEN** it MUST be covered through a rule-level end-to-end scenario
- **AND** the test MUST NOT call the helper directly

### Requirement: Rule tests SHALL use a single shared test utility

The only shared test utility for rule tests SHALL be `scenario()` from `src/utils/test-fixtures/index.ts`. That module SHALL expose only `scenario` unless this spec is updated first.

#### Scenario: Writing a rule test

- **WHEN** a test file under `src/rules/` defines a test case
- **THEN** it MUST use `scenario()`

#### Scenario: Adding shared test helpers

- **WHEN** a contributor wants to add another export to `src/utils/test-fixtures/index.ts`
- **THEN** they MUST first update this spec
- **AND** they MUST justify that the new export is needed by at least three test files and cannot be composed from `scenario()`

### Requirement: Rule tests SHALL be self-contained

Every test case SHALL declare all relevant inputs inline in the `scenario()` call so a reader can understand the case without scrolling elsewhere for source code, file layout, settings, or filename context.

#### Scenario: Declaring test inputs

- **WHEN** a scenario depends on source code, file paths, settings, or filesystem layout
- **THEN** those inputs MUST appear inline in that scenario's definition

#### Scenario: Reusing code snippets

- **WHEN** a contributor considers extracting a code string or fixture object into a module-scope constant
- **THEN** they SHOULD keep it inline unless the same value is shared by at least three scenarios in the same file

### Requirement: The scenario() API SHALL be the standard test shape

Rule tests SHALL express behavior through `scenario(description, rule, options)`, where `options` may include `files`, `typescript`, `settings`, `code`, `filename`, `errors`, and `output`.

#### Scenario: Simple valid case

- **WHEN** a rule test needs only source code and expects no diagnostics
- **THEN** the scenario MAY provide only `code`

#### Scenario: Invalid case with autofix

- **WHEN** a rule test expects a report and autofix
- **THEN** it MUST declare `errors`
- **AND** it MUST declare full expected `output`

#### Scenario: Invalid case without autofix

- **WHEN** a rule test expects a report but no safe fix
- **THEN** it MUST declare `errors`
- **AND** it SHOULD set `output: null` to assert that no autofix is emitted

#### Scenario: Filesystem-scanning rule

- **WHEN** a rule reads the filesystem during lint execution
- **THEN** the scenario MUST declare the needed files in `files`
- **AND** `filename` SHALL be resolved relative to the temporary directory created for that scenario

#### Scenario: TypeScript syntax under test

- **WHEN** the code under test uses TypeScript syntax
- **THEN** the scenario SHOULD set `typescript: true`
- **AND** it MUST NOT set `typescript: true` only because the rule implementation itself is written in TypeScript

#### Scenario: Architecture rule configuration

- **WHEN** a scenario exercises architecture-aware rules
- **THEN** it MUST provide the needed `settings.unslop` configuration inline

### Requirement: Rule tests SHALL prefer message identifiers

Assertions for diagnostics SHALL use `messageId` instead of literal `message` strings unless the message text is inherently dynamic.

#### Scenario: Static diagnostic assertion

- **WHEN** a rule reports a stable named message
- **THEN** the test MUST assert that diagnostic with `messageId`

#### Scenario: Dynamic diagnostic text

- **WHEN** a rule message cannot be asserted through a stable `messageId`
- **THEN** the test MAY assert the rendered message text instead

### Requirement: Spec scenarios SHALL be tracked in rule tests

Each named scenario in `openspec/specs/<rule>/spec.md` SHALL have at least one corresponding `scenario()` call in the relevant test file, and the mapping between the spec scenario name and the test description SHALL be obvious.

#### Scenario: Implemented spec scenario

- **WHEN** a named spec scenario is implemented
- **THEN** the rule test file MUST include at least one matching `scenario()` call
- **AND** the test description SHOULD mirror the spec scenario closely enough that the mapping is easy to review

#### Scenario: Unimplemented spec scenario

- **WHEN** a named spec scenario is not yet implemented in tests
- **THEN** the test file SHOULD include `scenario.todo()` with a matching description so the gap remains visible

### Requirement: Test descriptions SHALL read as behavior statements

Scenario descriptions SHALL describe externally observable behavior rather than internal implementation labels or bookkeeping names.

#### Scenario: Naming a passing or failing case

- **WHEN** a contributor writes a scenario description
- **THEN** it SHOULD read like a behavior statement such as `cross-module import not declared in allowlist is reported`
- **AND** it SHOULD NOT use labels such as `test 1` or implementation-centric shorthand

### Requirement: Rule tests SHALL avoid hidden lifecycle and assertion wrappers

Rule tests SHALL keep setup and assertions visible in the scenario body rather than hiding them behind lifecycle-managed fixtures or custom assertion wrappers.

#### Scenario: Custom assertion wrapper

- **WHEN** a contributor considers introducing a helper such as `assertValid()` or `assertInvalid()` that hides the `scenario()` call
- **THEN** they SHOULD write the scenario directly instead

#### Scenario: Module-scope fixture lifecycle

- **WHEN** a contributor considers using `beforeEach`, `afterEach`, or `afterAll` to manage shared temp fixtures for rule tests
- **THEN** they SHOULD express the needed files inline through `scenario({ files: [...] })` instead
