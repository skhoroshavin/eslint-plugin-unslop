## Context

- The `read-friendly-order` top-level analysis currently excludes helpers/constants when there is a direct eager runtime reference from module/global scope.
- A production failure showed an uncovered pattern: helper/constant usage can be eager through a transitive top-level call path (for example top-level `main()` invocation where `main` reads a later `const`).
- In this pattern, reordering can introduce a temporal dead zone runtime crash, and the rule currently does not treat it as eager.

## Goals / Non-Goals

**Goals:**

- Extend eager exclusion logic to include transitive top-level call paths, not only direct eager references.
- Keep behavior aligned with existing eager exclusions: affected symbols are excluded from reporting and autofix.
- Preserve deterministic ordering/fix behavior for non-eager cases.

**Non-Goals:**

- Full execution modeling for all JavaScript/TypeScript runtime constructs.
- Behavior changes for class-member ordering and test-phase ordering sub-rules.
- Reworking rule messaging or introducing a new diagnostic category.

## Decisions

1. Build a conservative top-level symbol dependency graph.

- Model only top-level symbols already relevant to this rule (function declarations and variable declarators treated as helper/constant entries).
- Rationale: captures known failure mode while keeping analysis bounded and deterministic.

2. Compute eager reachability as transitive closure from eager roots.

- Eager roots are symbols referenced from module/global runtime contexts.
- A helper/constant is eager-excluded when reachable from an eager root via symbol dependency edges.
- Rationale: treats direct and indirect eager use uniformly and naturally extends existing exclusion semantics.

3. Reuse eager exclusion set in both report gating and fix edge creation.

- The same eager-excluded symbol set gates diagnostics and reorder edges.
- Rationale: avoids drift where a symbol might be reported but not fixable (or vice versa) and keeps behavior predictable.

4. Keep exclusion conservative when analysis confidence is low.

- If symbol mapping or ranges are unavailable, prefer preserving current behavior for unaffected nodes and avoiding unsafe moves.
- Rationale: safety-first without broad false negatives.

Alternatives considered:

- Only suppress autofix and keep report for indirect eager cases: rejected for inconsistency with current eager-exclusion policy.
- Pattern-match only direct `main()` invocation shapes: rejected because real scripts often use transitive call chains.

## Risks / Trade-offs

- [Risk] Over-excluding reorder opportunities due to broad eager roots -> Mitigation: add control tests where non-eager paths still report.
- [Risk] Under-excluding due to missed dependency edges -> Mitigation: add direct + transitive eager regression tests from real failure shape.
- [Risk] Added analysis complexity in an already dense rule file -> Mitigation: isolate helper functions with small, testable responsibilities.

## Migration Plan

1. Add regression tests that encode failing pattern and transitive call-path variants.
2. Implement transitive eager reachability in top-level ordering analysis.
3. Run targeted rule tests, then full test/verify pipeline.
4. Release as a patch with changelog note about eager call-path exclusion fix.

Rollback strategy:

- Revert the reachability logic and keep regression tests (or temporarily mark failing cases) if unexpected false negatives appear.

## Open Questions

- Should class static blocks and decorators participate in eager roots for this rule, or remain out of scope until a separate change?
- Do we want a fixture copied from the external failing script shape for long-term regression clarity?
