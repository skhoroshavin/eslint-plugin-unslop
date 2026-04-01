## Why

`read-friendly-order` reports useful ordering violations, but users currently need to reorder code manually. Adding autofix for these diagnostics reduces friction, increases adoption, and aligns this rule with the plugin's existing autofix-oriented rules.

## What Changes

- Add autofix support for `read-friendly-order` across top-level helper and constant ordering, class member ordering, and test hook ordering.
- Make fix behavior deterministic by producing canonical reordering per fixable region so results converge quickly and avoid oscillation.
- Add conservative safety guards so ambiguous or potentially unsafe regions still report diagnostics without applying code changes.
- Add comprehensive tests that validate convergence, comment/trivia safety boundaries, and no-fix fallback behavior.

## Capabilities

### New Capabilities

- `read-friendly-order-autofix`: Canonical, safety-guarded autofix behavior for all `read-friendly-order` reordering diagnostics.

### Modified Capabilities

- None.

## Impact

- Affected rule code: `src/rules/read-friendly-order.ts`, `src/rules/read-friendly-order/class-order.ts`, `src/rules/read-friendly-order/test-order.ts`.
- Affected tests: `src/rules/read-friendly-order.test.ts`.
- No new runtime dependencies or external API changes.
- Expected behavior change: users running `eslint --fix` can automatically resolve many `read-friendly-order` violations in one pass.

## Non-goals

- Do not add autofix to unrelated rules.
- Do not broaden diagnostic scope beyond existing `read-friendly-order` messages and semantics.
- Do not guarantee fixing regions that fail safety checks; those remain report-only.
