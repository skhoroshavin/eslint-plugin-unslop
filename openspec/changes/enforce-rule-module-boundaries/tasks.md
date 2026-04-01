## 1. Restructure rule folders

- [ ] 1.1 Move each rule into `src/rules/<rule>/index.ts` and update local imports to match the new folder layout.
- [ ] 1.2 Move each rule test into its rule folder and update test imports to consume the rule through `index.ts`.
- [ ] 1.3 Keep larger rules split into sibling helper files only, without introducing nested subfolders.

## 2. Enforce architecture boundaries

- [ ] 2.1 Add dependency-cruiser as a development dependency and create an allowlist-style configuration for the rule registry, rule implementation files, and rule tests.
- [ ] 2.2 Wire the dependency-cruiser check into the repository workflow so boundary violations are caught during validation.
- [ ] 2.3 Update `src/rules/index.ts` so it imports only `src/rules/<rule>/index.ts` entrypoints.

## 3. Align repository self-linting

- [ ] 3.1 Update the repository's `unslop/no-false-sharing` configuration to use directory mode for shared areas under `src/`.
- [ ] 3.2 Run targeted rule tests after the migration to confirm imports and rule loading still work.
- [ ] 3.3 Run `npm run fix`, `npm run verify`, and `npm run test` to confirm the refactor and guardrails pass end-to-end.
