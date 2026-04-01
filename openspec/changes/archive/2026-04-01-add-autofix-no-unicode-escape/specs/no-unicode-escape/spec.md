## ADDED Requirements

### Requirement: Rule provides autofix for unicode escapes

The `no-unicode-escape` rule SHALL automatically fix `\uXXXX` escape sequences by replacing them with their literal Unicode characters when ESLint's `--fix` option is enabled.

#### Scenario: Basic ASCII escape fix

- **WHEN** a string contains `\u0041` (capital A)
- **THEN** the autofix SHALL replace it with `A`

#### Scenario: Multiple escapes in one string

- **WHEN** a string contains `\u0041\u0042\u0043` (ABC)
- **THEN** the autofix SHALL replace it with `ABC`

#### Scenario: Template literal escape fix

- **WHEN** a template literal quasi contains `\u0041`
- **THEN** the autofix SHALL replace it with `A` within the template

#### Scenario: Quote style preservation

- **WHEN** a single-quoted string `'\u0041'` is fixed
- **THEN** the output SHALL be `'A'` (preserving single quotes)
- **AND** when a double-quoted string `"\u0041"` is fixed
- **THEN** the output SHALL be `"A"` (preserving double quotes)

#### Scenario: Skipping unsafe characters - quote delimiters

- **WHEN** a string contains `\u0022` (double quote)
- **THEN** the rule SHALL report the violation
- **AND** the autofix SHALL NOT attempt to fix it

#### Scenario: Skipping unsafe characters - backslash

- **WHEN** a string contains `\u005C` (backslash)
- **THEN** the rule SHALL report the violation
- **AND** the autofix SHALL NOT attempt to fix it

#### Scenario: Skipping unsafe characters - control characters

- **WHEN** a string contains `\u000A` (newline) or `\u0009` (tab)
- **THEN** the rule SHALL report the violation
- **AND** the autofix SHALL NOT attempt to fix it

#### Scenario: Mixed safe and unsafe escapes

- **WHEN** a string contains `\u0041\u0022\u0042` (A"B)
- **THEN** the rule SHALL report the violation
- **AND** the autofix SHALL NOT fix anything (since partial fix would break the string)
