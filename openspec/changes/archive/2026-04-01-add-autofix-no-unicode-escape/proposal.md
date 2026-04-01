## Why

The `no-unicode-escape` rule currently flags `\uXXXX` escape sequences in string literals but requires manual fixes. This creates friction for developers who want to quickly clean up LLM-generated code containing unnecessary escapes. Adding autofix will let ESLint automatically convert these escapes to literal characters on `--fix`.

## What Changes

- Add autofix capability to `src/rules/no-unicode-escape.ts`
- Replace `\uXXXX` escape sequences with their corresponding literal Unicode characters
- Handle both regular string literals and template literal quasis
- Preserve the original quote style (`'`, `"`, or `` ` ``)
- Skip autofix for characters that would require escaping (e.g., `\u0022` quote delimiter, `\u005C` backslash)
- Update tests in `src/rules/no-unicode-escape.test.ts` to verify autofix output

## Capabilities

### New Capabilities

<!-- No new domain capabilities - this is an enhancement to existing rule behavior -->

### Modified Capabilities

<!-- This modifies the no-unicode-escape rule's behavior to include autofix -->

- `no-unicode-escape`: Adds autofix support to convert escape sequences to literal characters

## Impact

**Affected Files:**

- `src/rules/no-unicode-escape.ts` - Add `fix` function to `context.report()` calls
- `src/rules/no-unicode-escape.test.ts` - Add `output` assertions to invalid test cases

**Non-goals:**

- Do not autofix special characters that need escaping (quotes, backslashes, control chars)
- Do not handle `\u{XXXXXX}` ES6 extended escapes (out of scope)
- Do not change the rule's core detection logic
- Do not add options or configuration changes

**Breaking Changes:** None - this is an additive enhancement
