## Context

`read-friendly-order` currently detects ordering issues but does not provide autofix. The rule spans three domains with different safety profiles: top-level helper/constant ordering, class member ordering, and test hook ordering. A naive pairwise-swap fixer can oscillate across ESLint fix passes and can be brittle around comments and syntax edge cases.

The repository enforces strict complexity and function-size limits, so the implementation should prefer small reusable helpers over monolithic fix logic. The design also needs to preserve existing diagnostics semantics while adding fix output only where safety checks pass.

## Goals / Non-Goals

**Goals:**

- Add autofix support for all existing `read-friendly-order` reordering diagnostics.
- Ensure fixes are deterministic and converge to a stable result without ping-ponging.
- Apply conservative safety gates so unsupported/ambiguous regions remain report-only.
- Keep implementation aligned with existing code style and lint guardrails.

**Non-Goals:**

- Expanding the rule to detect new ordering patterns.
- Cross-file or project-wide reordering.
- Guaranteeing fixes in every reported case.

## Decisions

### 1) Canonical region replacement instead of iterative swaps

- Decision: For each fixable region, compute one canonical final order and replace the region text in a single fixer.
- Rationale: This makes the fix idempotent (`canonical(canonical(x)) = canonical(x)`) and avoids relying on high fix-pass counts.
- Alternatives considered:
  - Pairwise swaps per diagnostic: simpler locally, but can oscillate and require multiple passes.
  - "Fix one issue at a time": safer but slower convergence and less predictable final order.

### 2) Domain-specific canonicalization with shared ordering primitives

- Decision: Keep domain logic separate (top-level, class, test phases), but use shared utilities for stable topological ordering and range/text reconstruction.
- Rationale: Each domain has different constraints, while ordering and reconstruction mechanics are common.
- Alternatives considered:
  - One generic engine for everything: less duplication, but harder to model domain-specific guardrails clearly.

### 3) Conservative safety gating before emitting fixes

- Decision: Emit fixes only when node ranges are valid/non-overlapping and comment/trivia placement is unambiguous for the affected region.
- Rationale: Prevents semantically risky or formatting-destructive rewrites.
- Alternatives considered:
  - Always fix and rely on formatter/lint reruns: higher risk of incorrect transformations.
  - Disable fixes for complex regions entirely: safer, but misses desired full-scope autofix goal.

### 4) Cycle handling remains non-destructive

- Decision: For cyclic dependency groups, preserve current behavior of not forcing reorder; report as today but avoid unsafe auto-moves.
- Rationale: Cycles do not admit a strict dependency order without arbitrary choices.
- Alternatives considered:
  - Arbitrary cycle breaking via source index: deterministic but potentially misleading and risky.

## Risks / Trade-offs

- [Comment ownership ambiguity during node moves] -> Mitigation: skip fix when comments cannot be reliably attached to moved nodes.
- [Complex AST forms in classes (decorators/modifiers/computed names)] -> Mitigation: explicitly detect unsupported forms and leave report-only.
- [Increased implementation complexity] -> Mitigation: split into focused helpers and add targeted tests per domain.
- [Mismatch between report location and region-wide replacement] -> Mitigation: compute replacements from full region ranges and assert deterministic output in tests.

## Migration Plan

1. Implement autofix primitives and region-level reconstruction in `read-friendly-order` modules.
2. Add/expand tests for fixed output, guardrail no-fix paths, and idempotence.
3. Run focused rule tests, then broader verify/test commands.
4. Rollback strategy: if regressions appear, keep diagnostics but disable `fixable` metadata while preserving internal ordering logic for future iteration.

## Open Questions

- Should ambiguous comment regions be reported with a dedicated message hinting why no fix is provided, or remain silently report-only?
- Should top-level exported declarations and non-exported declarations share identical reorder boundaries, or be grouped separately for readability?
