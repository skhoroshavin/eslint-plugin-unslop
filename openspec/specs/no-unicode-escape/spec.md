## Purpose

Defines Unicode-escape handling and autofix behavior for `unslop/no-unicode-escape`.

## Requirements

### Requirement: Rule provides autofix for unicode escapes

The rule SHALL auto-fix `\uXXXX` escape sequences by replacing them with literal Unicode characters.

#### Scenario: Basic ASCII escape fix

- **WHEN** a string contains `\u0041`
- **THEN** replace with `A`

#### Scenario: Multiple escapes in one string

- **WHEN** a string contains `\u0041\u0042\u0043`
- **THEN** replace with `ABC`

#### Scenario: Template literal escape fix

- **WHEN** a template literal quasi contains `\u0041`
- **THEN** replace with `A`

#### Scenario: Quote style preservation

- **WHEN** a single-quoted string `'\u0041'` is fixed
- **THEN** output is `'A'` (preserving quotes); same for double-quoted

#### Scenario: Skipping unsafe characters - quote delimiters

- **WHEN** a string contains `\u0022` (double quote)
- **THEN** report but no fix

#### Scenario: Skipping unsafe characters - backslash

- **WHEN** a string contains `\u005C`
- **THEN** report but no fix

#### Scenario: Skipping unsafe characters - control characters

- **WHEN** a string contains `\u000A` (newline) or `\u0009` (tab)
- **THEN** report but no fix

#### Scenario: Mixed safe and unsafe escapes

- **WHEN** a string contains `\u0041\u0022\u0042`
- **THEN** report but no fix (partial fix would break string)
