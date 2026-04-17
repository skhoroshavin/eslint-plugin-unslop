## Context

`export-control` already contains behavior that goes beyond the smallest set of scenarios in `openspec/specs/export-control/spec.md` and `src/rules/export-control/index.test.ts`. In particular, the rule distinguishes unconditional `export *` rejection from entrypoint-only symbol-contract enforcement, and it evaluates source-bearing named exports through the same contract path as other named exports.

This change is intentionally narrow. The goal is to align the spec and RuleTester coverage with the rule's intended behavior, not to redesign export policy semantics or refactor the rule structure.

## Goals / Non-Goals

**Goals:**

- Make `export-control` requirements explicit for the export forms the rule is expected to enforce.
- Add end-to-end scenarios that cover the currently under-documented export shapes and entrypoint cases.
- Preserve the current small-function structure and only touch implementation if the clarified scenarios reveal an actual mismatch.

**Non-Goals:**

- Introducing new `export-control` configuration fields or matcher syntax.
- Changing shared architecture-policy parsing or other architecture-aware rules.
- Refactoring `export-control` for style alone when tests can capture the intended behavior directly.

## Decisions

### Treat this as a spec-and-test alignment change first

The primary implementation surface should be `openspec/specs/export-control/spec.md` and `src/rules/export-control/index.test.ts`. The rule already contains logic for export-all rejection in all files and symbol-contract checks only for active constrained entrypoints, so the first step is to express those expectations clearly.

The alternative would be to start by reshaping `src/rules/export-control/index.ts`, but that would risk changing behavior before the repository has an agreed contract for the missing scenarios.

### Add scenario coverage for export shapes the rule already distinguishes

The new scenarios should focus on the boundary between behaviors already visible in `src/rules/export-control/index.ts`:

- `export * from ...` remains rejected in all files.
- Symbol-contract enforcement applies only when the file is a configured entrypoint for a module with `exports` patterns.
- Source-bearing named exports in constrained entrypoints are checked against the configured contract.
- Non-entrypoint files remain outside symbol-contract enforcement even when architecture settings are present.

The alternative would be to add broad export-shape coverage without tying each scenario back to a specific rule branch, but that would make it harder to tell whether a failing test represents an intended contract gap or redundant coverage.

### Keep any rule change minimal and evidence-driven

If the new scenarios fail, the follow-up code change should stay inside `src/rules/export-control/index.ts` and preserve the existing division between rule-state setup, export-all handling, and symbol reporting. The goal is to make the rule conform to the clarified spec with the smallest possible behavioral adjustment.

The alternative would be to proactively refactor helper boundaries before adding scenarios, but that increases change surface without improving the contract.

## Risks / Trade-offs

- [The current implementation may not exactly match the newly documented scenarios] -> Mitigation: treat spec and tests as the source of truth for this change, then make the smallest rule update needed to restore alignment.
- [The change could drift into redefining export semantics instead of clarifying them] -> Mitigation: keep the scenarios anchored to behavior that already exists in `export-control` and avoid adding new policy concepts.
- [Additional tests may duplicate existing coverage without improving confidence] -> Mitigation: add scenarios only where they exercise a distinct rule branch or clarify an ambiguous requirement.

## Migration Plan

No user-facing migration is required. Existing `export-control` configuration remains unchanged. The work sequence is:

1. Update the `export-control` spec to describe the missing requirement boundaries.
2. Add RuleTester scenarios that map to those requirements.
3. Adjust `src/rules/export-control/index.ts` only if the new tests expose a mismatch.

Rollback is straightforward: revert the spec, tests, and any minimal rule adjustment together.

## Open Questions

- Whether every source-bearing named export shape needs explicit scenario coverage, or only the ones that exercise distinct behavior branches in the current rule.
