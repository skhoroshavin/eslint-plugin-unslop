## Why

The `no-special-unicode` rule detects problematic unicode characters (smart quotes, special spaces, dashes) that commonly appear when copying text from word processors. Currently, developers must manually fix these violations. Adding autofix support will allow `eslint --fix` to automatically replace these characters with their ASCII equivalents, saving time and reducing friction when linting.

## What Changes

- Add `fixable: 'code'` to the rule's meta configuration
- Implement a `fix()` function that replaces each banned unicode character with its ASCII equivalent
- Update test cases to verify autofix behavior produces correct output
- Ensure the fix handles all 19 banned characters with appropriate replacements

## Capabilities

### New Capabilities

- `special-unicode-autofix`: Automatic replacement of special unicode characters in string literals and template literals with their ASCII equivalents

### Modified Capabilities

- (none - this is purely additive, no spec requirement changes)

## Impact

- `src/rules/no-special-unicode.ts`: Add autofix implementation
- `src/rules/no-special-unicode.test.ts`: Add test cases for autofix output

## Non-goals

- Not modifying how violations are detected (detection logic remains unchanged)
- Not adding new banned characters or changing the character set
- Not modifying the error message format
