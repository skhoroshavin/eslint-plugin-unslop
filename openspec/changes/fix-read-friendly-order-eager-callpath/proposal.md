# Fix read-friendly-order eager call-path exclusions

Summary

- Update the `read-friendly-order` rule so eager exclusion logic covers transitive top-level call paths, not only direct module-scope reads. This prevents false positives where moving a top-level `const` below a function declaration would introduce a temporal dead zone runtime failure because that function is eagerly invoked at module initialization time.

Why

- A real release pipeline failure in `skhoroshavin/Arbeitssuche` showed the current rule can suggest unsafe ordering in scripts like `scripts/bump-version.ts`.
- Current eager checks only detect direct eager references to a helper/constant, but miss indirect eager use through an eagerly called top-level function (for example, top-level `main()` calling code that reads a later `const`).

Goals

- Treat indirect eager use through top-level call chains as part of eager exclusions.
- Preserve current behavior for existing direct eager exclusions.
- Keep ordering diagnostics for non-eager cases unchanged.

Non-Goals

- Full program execution modeling beyond top-level symbol reachability.
- Expanding this change to unrelated rule behavior (class member or test hook ordering).

Success criteria

- Cases with eager top-level call paths that transitively use a helper/constant are treated as valid (no report, no autofix).
- Existing eager valid cases continue to pass unchanged.
- Existing non-eager invalid cases continue to report and autofix as before.

Rollout plan

1. Add focused regression tests for direct and transitive eager call-path exclusions.
2. Implement transitive eager reachability for top-level symbols and integrate it into report/fix gating.
3. Validate with targeted `read-friendly-order` tests, then full suite verification.

Risks and mitigation

- Over-excluding symbols (false negatives) if eager roots are too broad; mitigate with conservative symbol selection and control tests.
- Under-excluding symbols if transitive edges miss realistic patterns; mitigate with direct + transitive regression fixtures.

Alternatives considered

- Suppress autofix but keep reports for these cases: rejected because eager exclusions in this rule currently suppress reporting, and this class of issue should behave consistently.
- Only patch specific invocation shapes (for example, direct `main()`): rejected because transitive call chains are common in scripts and should be covered by design.

Location

- Change artifacts created at `openspec/changes/fix-read-friendly-order-eager-callpath/`.
