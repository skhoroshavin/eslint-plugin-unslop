## 1. Shared architecture policy foundation

- [x] 1.1 Add shared architecture policy types and parsing helpers for `settings.unslop.architecture` with validation for module keys, `imports`, `exports`, and `shared`.
- [x] 1.2 Implement path normalization, module matcher resolution, and deterministic precedence selection for overlapping matchers.
- [x] 1.3 Add utility tests for matcher precedence, wildcard handling, and invalid policy inputs.

## 2. Implement `unslop/import-control`

- [x] 2.1 Create `src/rules/import-control/index.ts` with deny-by-default cross-module edge checks driven by `imports` allowlists.
- [x] 2.2 Enforce fail-closed behavior for unmatched importer/importee modules with actionable diagnostics.
- [x] 2.3 Enforce entrypoint-only cross-module imports (`index.ts` or `types.ts`) and reject non-entrypoint targets.
- [x] 2.4 Fold shallow deep-import checks into same-module handling (allow at most one level deeper).
- [x] 2.5 Add `src/rules/import-control/index.test.ts` covering allowed edges, denied edges, unmatched modules, entrypoint gating, and depth constraints.

## 3. Implement `unslop/export-control`

- [x] 3.1 Create `src/rules/export-control/index.ts` to enforce `exports` regex allowlists on symbols exported from `index.ts` and `types.ts`.
- [x] 3.2 Keep permissive default behavior for modules without `exports` policies and report violations at producer export sites.
- [x] 3.3 Reject `export *` in constrained entrypoints and validate default export name handling as `default`.
- [x] 3.4 Add `src/rules/export-control/index.test.ts` for permissive default, matching/non-matching exports, re-export behavior, and export-all rejection.

## 4. Integrate and document architecture rules

- [x] 4.1 Register new rules in `src/rules/index.ts` and wire plugin config exports in `src/index.ts`.
- [x] 4.2 Add README documentation for `import-control`, `export-control`, and shared architecture settings with concise examples.
- [x] 4.3 Plan and implement `no-deep-imports` deprecation path after parity verification with `import-control` behavior.

## 5. Verification and repository alignment

- [x] 5.1 Update repository ESLint configuration to use the new shared architecture settings and rules.
- [x] 5.2 Run `npm run fix`, `npm run verify`, and `npm run test`, then resolve any failures.
- [x] 5.3 Confirm rule-module-boundaries capability alignment with updated OpenSpec specs and adjust follow-up tasks if gaps remain.
