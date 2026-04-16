## 1. Shared Architecture Matcher

- [ ] 1.1 Add or expand focused tests for `src/utils/architecture-policy.ts`, covering canonical module paths, subtree ownership precedence, invalid key selectors, and anonymous-module defaults.
- [ ] 1.2 Update `src/utils/architecture-policy.ts` to validate supported architecture key forms, reject file-shaped and unsupported selectors, and surface shared configuration errors.
- [ ] 1.3 Rework shared architecture matching to derive canonical module paths from containing directories and select the nearest owning key by the new subtree precedence rules.
- [ ] 1.4 Update shared policy resolution to preserve anonymous-module defaults and expose the canonical module path / effective owner data needed by architecture-aware rules.

## 2. Import Control Integration

- [ ] 2.1 Update `src/rules/import-control/index.test.ts` to match the new specs, including parent-vs-child matching, `/+`, unsupported key errors, and the `models/*` vs parent entrypoint fix.
- [ ] 2.2 Update `src/rules/import-control/index.ts` to use canonical target module paths for allowlist checks and implement exact, `/*`, and `/+` import pattern matching.

## 3. Other Architecture Consumers

- [ ] 3.1 Update `src/rules/no-whitebox-testing/index.test.ts` to match the new specs for shared module ownership, entrypoint defaults, and invalid architecture-key handling.
- [ ] 3.2 Update `src/rules/no-whitebox-testing/index.ts` to consume shared module ownership and entrypoint semantics from the architecture matcher instead of duplicating them.
- [ ] 3.3 Update `src/rules/no-false-sharing/index.test.ts` to match the new specs for shared module ownership and policy resolution.
- [ ] 3.4 Update `src/rules/no-false-sharing/index.ts` to consume shared module ownership / policy semantics from the architecture matcher.
- [ ] 3.5 Update plugin config tests to reflect the current `configs.full` rule set and shared architecture-config error behavior.
- [ ] 3.6 Update plugin config code or expectations as needed to keep `configs.full` aligned with the revised spec.

## 4. Docs And Config Migration

- [ ] 4.1 Update user-facing documentation for architecture configuration, including canonical module paths, subtree-owning keys, `imports` `/+` syntax, precedence, and the removal of file-shaped keys.
- [ ] 4.2 Update dogfooded and fixture ESLint architecture configs to use directory-shaped keys only and replace repeated parent-plus-child allowlists with `/+` where applicable.

## 5. Verification

- [ ] 5.1 Run `npm run fix` and address any formatting or lint autofixes.
- [ ] 5.2 Run `npm run verify` and fix any remaining typecheck, build, lint, or config issues.
- [ ] 5.3 Run `npm run test` and fix any failing rule scenarios or config expectations.
