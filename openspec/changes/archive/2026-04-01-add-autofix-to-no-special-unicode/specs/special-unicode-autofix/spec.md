## ADDED Requirements

### Requirement: Special unicode characters are replaced with ASCII equivalents

The rule SHALL automatically replace detected special unicode characters in string literals and template literals with their ASCII equivalents when autofix is applied.

#### Scenario: Smart quotes are replaced with straight quotes

- **WHEN** a string contains `"` (left double quotation mark)
- **THEN** autofix SHALL replace it with `"`
- **WHEN** a string contains `"` (right double quotation mark)
- **THEN** autofix SHALL replace it with `"`
- **WHEN** a string contains `'` (left single quotation mark)
- **THEN** autofix SHALL replace it with `'`
- **WHEN** a string contains `'` (right single quotation mark)
- **THEN** autofix SHALL replace it with `'`

#### Scenario: Special spaces are replaced with regular space

- **WHEN** a string contains ` ` (non-breaking space, U+00A0)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains ` ` (narrow no-break space, U+202F)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains ` ` (figure space, U+2007)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains ` ` (punctuation space, U+2008)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains ` ` (thin space, U+2009)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains `` (hair space, U+200A)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains `` (en space, U+2002)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains `` (em space, U+2003)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains `` (medium mathematical space, U+205F)
- **THEN** autofix SHALL replace it with regular space ` `
- **WHEN** a string contains `` (ideographic space, U+3000)
- **THEN** autofix SHALL replace it with regular space ` `

#### Scenario: Zero-width characters are handled appropriately

- **WHEN** a string contains zero-width space (U+200B)
- **THEN** autofix SHALL remove it entirely
- **WHEN** a string contains zero-width no-break space/BOM (U+FEFF)
- **THEN** autofix SHALL remove it entirely

#### Scenario: Dashes are replaced with hyphens

- **WHEN** a string contains `–` (en dash, U+2013)
- **THEN** autofix SHALL replace it with `-` (hyphen)
- **WHEN** a string contains `—` (em dash, U+2014)
- **THEN** autofix SHALL replace it with `-` (hyphen)

#### Scenario: Ellipsis is replaced with three dots

- **WHEN** a string contains `…` (horizontal ellipsis, U+2026)
- **THEN** autofix SHALL replace it with `...` (three dots)

#### Scenario: Multiple banned characters in same string are all fixed

- **WHEN** a string contains multiple different banned characters
- **THEN** autofix SHALL replace all of them in a single fix operation

#### Scenario: Template literals are fixed the same as regular strings

- **WHEN** a template literal contains banned characters
- **THEN** autofix SHALL replace them with the same ASCII equivalents

### Requirement: Quote safety prevents invalid string literal fixes

The rule SHALL NOT apply autofix when replacing a smart quote would create a string literal containing the same quote character as its wrapper, as this would produce invalid JavaScript.

#### Scenario: Smart double quotes inside double-quoted strings are not auto-fixed

- **WHEN** a double-quoted string contains `"` (left double quotation mark)
- **THEN** autofix SHALL NOT replace it (would break the string)
- **WHEN** a double-quoted string contains `"` (right double quotation mark)
- **THEN** autofix SHALL NOT replace it (would break the string)
- **WHEN** a double-quoted string contains `'` (left single quotation mark)
- **THEN** autofix SHALL replace it with `'`
- **WHEN** a double-quoted string contains `'` (right single quotation mark)
- **THEN** autofix SHALL replace it with `'`

#### Scenario: Smart single quotes inside single-quoted strings are not auto-fixed

- **WHEN** a single-quoted string contains `'` (left single quotation mark)
- **THEN** autofix SHALL NOT replace it (would break the string)
- **WHEN** a single-quoted string contains `'` (right single quotation mark)
- **THEN** autofix SHALL NOT replace it (would break the string)
- **WHEN** a single-quoted string contains `"` (left double quotation mark)
- **THEN** autofix SHALL replace it with `"`
- **WHEN** a single-quoted string contains `"` (right double quotation mark)
- **THEN** autofix SHALL replace it with `"`

#### Scenario: All smart quotes in template literals and backtick strings are fixed

- **WHEN** a template literal contains smart quotes
- **THEN** autofix SHALL replace ALL of them (backticks are different characters)
- **WHEN** a backtick-quoted string contains smart quotes
- **THEN** autofix SHALL replace ALL of them
