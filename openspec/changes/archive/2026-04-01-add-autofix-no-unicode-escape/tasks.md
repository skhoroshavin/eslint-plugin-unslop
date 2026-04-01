## 1. Preparation

- [x] 1.1 Read current `src/rules/no-unicode-escape.ts` implementation
- [x] 1.2 Read `src/utils/string-literal-listener.ts` to understand node types received
- [x] 1.3 Read current `src/rules/no-unicode-escape.test.ts` test structure
- [x] 1.4 Examine how existing rule tests handle autofix `output` assertions

## 2. Core Implementation

- [x] 2.1 Add `isUnsafeChar()` helper function to detect characters needing escaping
  - Skip: quotes (0x22, 0x27, 0x60), backslash (0x5C), control chars (0x00-0x1F)
- [x] 2.2 Add `computeReplacement()` function to convert escapes to literals
  - Handle regex replace of `\uXXXX` patterns
  - Skip unsafe characters (leave them as escapes)
  - Return null if no changes made
- [x] 2.3 Add `getQuote()` helper to detect quote style from node.raw
  - Return `"`, `'`, `` ` ``, or undefined for template literals
- [x] 2.4 Modify `context.report()` call to include `fix()` function
  - Call `computeReplacement()` to get fixed text
  - Re-wrap with proper quotes for Literal nodes
  - Use `fixer.replaceText()` to apply fix
  - Return null if no safe fix possible

## 3. Testing

- [x] 3.1 Add autofix test: Basic ASCII escape `\u0041` → `A` (double quotes)
- [x] 3.2 Add autofix test: Basic ASCII escape `\u0041` → `A` (single quotes)
- [x] 3.3 Add autofix test: Multiple escapes `\u0041\u0042` → `AB`
- [x] 3.4 Add autofix test: Template literal `` `\u0041` `` → `` `A` ``
- [x] 3.5 Add test: Unsafe character `\u0022` (quote) - no autofix, just error
- [x] 3.6 Add test: Unsafe character `\u005C` (backslash) - no autofix, just error
- [x] 3.7 Add test: Mixed safe/unsafe `\u0041\u0022\u0042` - no autofix (all or nothing)
- [x] 3.8 Run `npm run test -- src/rules/no-unicode-escape.test.ts` - all tests pass

## 4. Validation

- [x] 4.1 Run `npm run typecheck` - no TypeScript errors
- [x] 4.2 Run `npm run lint` - passes linting
- [x] 4.3 Run `npm run verify` - full validation passes
