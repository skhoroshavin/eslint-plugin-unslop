## 1. Restructure rule folders

- [x] 1.1 Move each rule into `src/rules/<rule>/index.ts` and update local imports to match the new folder layout.
- [x] 1.2 Move each rule test into its rule folder and update test imports to consume the rule through `index.ts`.
- [x] 1.3 Keep larger rules split into sibling helper files only, without introducing nested subfolders.

## 2. Enforce architecture boundaries

- [x] 2.1 Add dependency-cruiser as a development dependency and create an allowlist-style configuration (`allowed` rules) for the plugin entrypoint, rule registry, rule implementation files, rule tests, and `src/utils` boundaries.
- [x] 2.2 Wire the dependency-cruiser check into existing repository workflow scripts (no standalone helper script) so boundary violations are caught during validation.
- [x] 2.3 Update `src/rules/index.ts` so it imports only `src/rules/<rule>/index.ts` entrypoints.

## 3. Align repository self-linting

- [x] 3.1 Update the repository's `unslop/no-false-sharing` configuration to use directory mode for shared areas under `src/`.
- [x] 3.2 Run targeted rule tests after the migration to confirm imports and rule loading still work.
- [x] 3.3 Run `npm run fix`, `npm run verify`, and `npm run test` to confirm the refactor and guardrails pass end-to-end.
