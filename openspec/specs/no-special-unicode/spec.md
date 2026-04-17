## Purpose

Defines special-Unicode normalization behavior enforced by `unslop/no-special-unicode`.

## Requirements

### Requirement: Special unicode characters are replaced with ASCII equivalents

The rule SHALL auto-replace detected special Unicode characters in string and template literals.

#### Scenario: Smart quotes are replaced with straight quotes

- **WHEN** a string contains `\u201c`/`\u201d` (left/right double quotation marks)
- **THEN** replace with `"`
- **WHEN** a string contains `\u2018`/`\u2019` (left/right single quotation marks)
- **THEN** replace with `'`

#### Scenario: Special spaces are replaced with regular space

- **WHEN** a string contains non-breaking space (U+00A0), narrow no-break space (U+202F), figure space (U+2007), punctuation space (U+2008), thin space (U+2009), hair space (U+200A), en space (U+2002), em space (U+2003), medium mathematical space (U+205F), or ideographic space (U+3000)
- **THEN** replace with regular space

#### Scenario: Zero-width characters are handled appropriately

- **WHEN** a string contains zero-width space (U+200B) or zero-width no-break space/BOM (U+FEFF)
- **THEN** remove entirely

#### Scenario: Dashes are replaced with hyphens

- **WHEN** a string contains en dash (U+2013) or em dash (U+2014)
- **THEN** replace with `-`

#### Scenario: Ellipsis is replaced with three dots

- **WHEN** a string contains `\u2026` (horizontal ellipsis)
- **THEN** replace with `...`

#### Scenario: Multiple banned characters in same string are all fixed

- **WHEN** a string contains multiple different banned characters
- **THEN** replace all in a single fix operation

#### Scenario: Template literals are fixed the same as regular strings

- **WHEN** a template literal contains banned characters
- **THEN** replace with same ASCII equivalents

### Requirement: Quote safety prevents invalid string literal fixes

The rule MUST NOT autofix when replacing a smart quote would create the same quote character as the wrapper.

#### Scenario: Smart double quotes inside double-quoted strings are not auto-fixed

- **WHEN** a double-quoted string contains `\u201c`/`\u201d`
- **THEN** no fix (would break the string); `\u2018`/`\u2019` in double-quoted strings are still fixed

#### Scenario: Smart single quotes inside single-quoted strings are not auto-fixed

- **WHEN** a single-quoted string contains `\u2018`/`\u2019`
- **THEN** no fix; `\u201c`/`\u201d` in single-quoted strings are still fixed

#### Scenario: All smart quotes in template literals and backtick strings are fixed

- **WHEN** a template literal contains smart quotes
- **THEN** all replaced (backticks are different characters)
