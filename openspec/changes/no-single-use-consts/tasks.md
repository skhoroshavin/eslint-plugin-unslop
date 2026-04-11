## 1. Shared TypeScript Context

- [x] 1.1 Read the existing `no-false-sharing` rule, `architecture-policy` utilities, and TS project helper code to confirm the extraction boundary.
- [x] 1.2 Extract `getTypeScriptProjectContext(filename)` into `src/utils/ts-program.ts` with the current tsconfig discovery, semantic program creation, caching, and graceful fallback behavior.
- [x] 1.3 Update `src/utils/index.ts`, `src/utils/architecture-policy.ts`, and any related utility imports so architecture rules reuse the new shared TS project-context helper without changing current behavior.

## 2. Rule Implementation

- [x] 2.1 Create `src/rules/no-single-use-constants/index.ts` with module-scope `const` filtering for plain identifiers and excluded function/class-expression initializers.
- [x] 2.2 Implement local read-reference counting for non-exported constants and semantic project-wide counting for exported constants, excluding import/export-only positions and `export default IDENTIFIER`.
- [x] 2.3 Add the `singleUse` diagnostic message and register the rule in the plugin's rule registry and config wiring as needed.

## 3. Specification Coverage Tests

- [x] 3.1 Read `openspec/specs/test-conventions/spec.md` and the colocated rule test patterns before adding scenarios.
- [x] 3.2 Add RuleTester coverage for zero-use, one-use, and two-use module-scope constants using `scenario()` fixtures.
- [x] 3.3 Add RuleTester coverage for excluded declarators and initializers, ignored import/export-only positions, cross-file exported usage, alias-based usage, and semantic-project-unavailable fallback.
- [x] 3.4 Update or add coverage that protects the shared TS project-context behavior used by `no-false-sharing` after the utility extraction.

## 4. Verification

- [x] 4.1 Run `npm run fix` and address any remaining issues.
- [x] 4.2 Run `npm run verify` and fix any failures.
- [x] 4.3 Run `npm run test` and confirm the full suite passes.
