## Context

`eslint-plugin-unslop` currently focuses on code-quality and structure rules, while architecture governance in user projects is often configured in separate tools with different policy formats. The change introduces architecture enforcement directly in the plugin so teams can describe dependency direction and public API constraints in one ESLint-native policy.

This design must fit existing repository constraints: strict TypeScript, small focused helpers, deterministic behavior, and robust lint-time execution without throwing when analysis is incomplete.

## Goals / Non-Goals

**Goals:**

- Provide a single shared policy object under `settings.unslop.architecture` consumed by multiple rules.
- Enforce deny-by-default cross-module imports via `unslop/import-control`.
- Enforce public-entrypoint-only cross-module imports (`index.ts` and `types.ts`) via `unslop/import-control`.
- Enforce optional symbol-level export policy via `unslop/export-control`.
- Keep export policy permissive by default for modules without explicit `exports` rules.
- Fail closed for unmatched modules in import-control to avoid accidental policy gaps.
- Fold deep-import constraints into `unslop/import-control` so architecture and depth checks are managed in one rule family.

**Non-Goals:**

- Reworking unrelated existing rules in this change.
- Full static analysis of non-literal dynamic imports and runtime-computed paths.
- Mandatory symbol contracts for every module.
- Building a separate architecture CLI in this iteration.

## Decisions

### 1) Use one shared architecture policy in ESLint settings

Decision:

- Define policy in `settings.unslop.architecture` with compact per-module entries:
  - key: module matcher (for example `repository/*`)
  - value: optional `imports`, optional `exports`, optional `shared`

Rationale:

- Keeps architecture and other unslop rules in one configuration system.
- Minimizes verbosity compared with zone-based external configs.
- Allows future rules (`no-false-sharing`) to reuse the same model.

Alternatives considered:

- Separate standalone architecture tool: rejected for split configuration ownership.
- Rule-local options only: rejected because shared policy would be duplicated.

### 2) Split responsibility into two rules

Decision:

- `unslop/import-control` enforces module dependency direction, public entrypoint usage, and shallow same-module depth.
- `unslop/export-control` enforces symbol-level public API restrictions only where a module declares `exports`.

Rationale:

- Keeps each rule conceptually narrow and easier to reason about/test.
- Supports independent rollout (teams can enable import control first).

Alternatives considered:

- Single monolithic `architecture-control` rule: rejected due to complexity and poorer diagnostics.

### 3) Import control is deny-by-default and fail-closed

Decision:

- Cross-module imports are forbidden unless importer policy explicitly allows target module in `imports`.
- If importer or importee cannot be matched to any architecture key, report violation.
- Same-module imports are allowed with shallow depth only (at most one level deeper), replacing separate deep-import enforcement for covered files.
- Cross-module imports must target `index.ts` or `types.ts` in the target module.

Rationale:

- Boundary systems should default to safety and surface gaps early.
- Prevents silent policy bypass from forgotten module declarations.
- Keeps public API consumption consistent and opinionated in v1.
- Reduces duplicated architecture checks by absorbing deep-import behavior.

Alternatives considered:

- Allow unmatched modules (fail-open): rejected because it hides architecture drift.
- Keep deep-import enforcement permanently separate from architecture control: rejected because it duplicates boundary intent.

### 4) Export control is permissive-by-default, strict-by-opt-in

Decision:

- If a module has no `exports` rule, exported symbols are not constrained by `unslop/export-control`.
- If a module defines `exports` regex patterns, every exported symbol name declared from that module's `index.ts` and `types.ts` must match at least one regex.
- Violations are reported at export declaration/re-export sites in `index.ts` or `types.ts` (producer-side enforcement).

Rationale:

- Enables gradual adoption without breaking all modules at once.
- Gives precise control where API contracts matter and prevents accidental public API drift at source.

Alternatives considered:

- Global strict export surface by default: rejected as too disruptive for initial rollout.

### 5) Edge-case behavior is explicit and deterministic

Decision:

- `import type` is evaluated the same as value imports.
- Re-exports (`export { x } from`, `export * from`) are evaluated by `export-control` when they appear in constrained module entrypoints.
- `default` export names are checked using symbolic name `default`.
- `export *` in constrained entrypoints is rejected (cannot statically guarantee symbol-name allowlist compliance).
- Dynamic import / require checks apply only to string-literal specifiers in v0.
- Cross-module imports to non-entrypoint files are always rejected, independent of `exports` policy.

Rationale:

- Avoids ambiguous behavior and bypass paths.
- Keeps v0 implementation tractable while still enforcing meaningful boundaries.

Alternatives considered:

- Ignore type imports/re-exports: rejected because architecture coupling still exists.
- Allow unconstrained `export *` under export contracts: rejected because it bypasses symbol allowlists.

### 6) Matching precedence must be stable

Decision:

- When multiple module matchers fit a file path, resolve by:
  1. exact matcher (no wildcard) over wildcard matcher
  2. fewer wildcards
  3. longer matcher string
  4. first declaration order

Rationale:

- Provides predictable behavior without additional priority fields.

Alternatives considered:

- Require explicit numeric priority: rejected for extra config noise.

## Risks / Trade-offs

- [Complex matcher behavior] -> Mitigation: document precedence clearly and add targeted fixture tests for overlap scenarios.
- [False positives from unresolved paths] -> Mitigation: keep resolution deterministic, report with actionable diagnostics, and cover alias/extension/index resolution in tests.
- [Perceived strictness from fail-closed import policy] -> Mitigation: include clear messages suggesting which module key is missing or which `imports` entry to add.
- [Symbol-regex usability friction] -> Mitigation: provide readable examples and validate regex strings with helpful config errors.

## Migration Plan

1. Introduce shared architecture policy parser and matcher utilities.
2. Implement `unslop/import-control` and add rule tests for allow/deny, unmatched modules, entrypoint-only cross-module imports, and depth constraints.
3. Implement `unslop/export-control` and add tests for permissive default plus constrained-module entrypoint export-name validation.
4. Fold current deep-import behavior into `unslop/import-control` and deprecate `unslop/no-deep-imports` after parity validation.
5. Register both rules in plugin exports and document configuration in `README.md`.
6. Update repository architecture capability specs to reference plugin-native policy.
7. In follow-up, evaluate reusing `shared: true` in `no-false-sharing` to consolidate policy sources.

Rollback strategy:

- Disable new rules in config while keeping existing rules intact; no data migration is required.

## Open Questions

- Should wildcard matcher semantics support captured segment constraints in v1 (for example matching same feature instance), or stay simple in v0?
- Should unresolved local import specifiers be hard errors immediately, or optionally strict behind a future flag?
- Should entrypoint policy remain fixed to `index.ts` and `types.ts` in v1, or become configurable in a later iteration?
