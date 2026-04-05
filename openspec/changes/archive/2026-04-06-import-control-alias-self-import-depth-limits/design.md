## Context

`unslop/import-control` currently applies same-module depth checks to `./` imports, but alias imports (for example `@/ui/pages/applicant/components`) can resolve to the same module instance without triggering the same depth restriction. The proposal requires import-style parity: if two local imports resolve to the same module relationship, they should be judged by the same depth policy. The change is limited to `import-control` behavior and colocated rule tests.

## Goals / Non-Goals

**Goals:**

- Enforce same-module depth limits based on resolved module relationship, not raw import string prefix.
- Reject deep alias self-imports when they target internals two or more levels deeper in the same module instance.
- Preserve existing allowed behavior for cross-module alias imports that resolve to `index.ts` or `types.ts` and satisfy architecture `imports` policy.
- Keep rule behavior deterministic and maintainable within current lint complexity constraints.

**Non-Goals:**

- Introducing new rule options or changing `settings.unslop.architecture` format.
- Changing unrelated namespace-import, export-control, or no-false-sharing behavior.
- Reworking path resolution infrastructure beyond what is needed for same-module depth parity.

## Decisions

### 1) Compare resolved module identity before applying depth rule

- Decision: run same-module depth enforcement whenever importer and import target resolve to the same module instance, independent of whether the specifier starts with `./` or alias syntax.
- Rationale: the requirement is about architectural relationship (same module), not syntax; this closes alias bypasses while keeping intent clear.
- Clarification: apply this with no alias-specific exceptions; alias and relative imports use identical depth semantics, including index and extensionless resolution paths.
- Alternative considered: keep relative-only depth enforcement and document alias caveat. Rejected because it leaves a known policy gap and inconsistent behavior.

### 2) Reuse existing alias/target resolution pipeline

- Decision: leverage current import-control target resolution that already maps local alias and relative imports to normalized local file paths, then feed that resolved path into same-module depth checks.
- Rationale: avoids duplicate resolution logic and reduces regression risk.
- Alternative considered: add a separate alias-specific depth checker keyed on string parsing. Rejected because it duplicates logic and can drift from canonical resolution.

### 3) Keep current cross-module entrypoint policy unchanged

- Decision: apply the new parity only to same-module depth checks; cross-module allow/deny decisions continue to use existing architecture dependency and entrypoint checks.
- Rationale: requirement explicitly preserves cross-module alias entrypoint behavior.
- Alternative considered: tighten all alias imports in the same pass. Rejected as scope creep and not required by proposal.

### 4) Expand end-to-end RuleTester scenarios to lock behavior

- Decision: add explicit scenarios for (a) same-module shallow relative allowed, (b) same-module deep relative rejected, (c) same-module deep alias rejected, and (d) cross-module alias to public entrypoint allowed.
- Rationale: these scenarios directly encode the updated contract and prevent regressions.
- Alternative considered: minimal test delta covering only deep alias rejection. Rejected because parity requirements include both unchanged and changed behavior.

## Risks / Trade-offs

- [Risk] Alias resolution edge cases (extensions, index inference) could classify imports incorrectly. → Mitigation: rely on existing normalized resolver behavior and add targeted tests for alias resolution paths used by import-control.
- [Risk] Same-module depth logic may over-fire on imports that resolve unexpectedly due to config mistakes. → Mitigation: preserve current graceful-failure behavior when local target resolution is unavailable.
- [Trade-off] Slightly more branching in import-control path classification. → Mitigation: keep helper boundaries small and test behavior through scenario-focused cases.

## Migration Plan

1. Update `architecture-import-export-control` delta spec to require same-module depth parity for alias and relative imports.
2. Implement `import-control` logic changes and add/adjust RuleTester scenarios.
3. Run targeted import-control tests first, then full verification (`npm run verify`) and full tests (`npm run test`).
4. Rollback strategy: revert the rule changes and spec delta in one commit if unexpected false positives appear.

## Open Questions

- None.
