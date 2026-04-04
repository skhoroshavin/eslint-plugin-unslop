## Context

The repository already has CI automation for pull requests and pushes to `main`, but that automation is not yet coupled to a documented, enforceable branch protection contract. In practice, maintainers can accidentally merge without all intended review and validation gates if repository settings drift or if check names are unstable.

This change needs a design that keeps governance simple: reuse existing workflows where possible, keep status checks deterministic, and avoid adding CI complexity that increases maintenance burden for a small TypeScript ESLint plugin project.

## Goals / Non-Goals

**Goals:**

- Make `main` protection requirements explicit and enforceable through GitHub branch protection or rulesets.
- Ensure required PR checks map to stable GitHub Actions job names so protection configuration remains reliable over time.
- Preserve current validation depth (`npm run verify` and `npm run test`) while improving merge governance.
- Document maintainer operating guidance for applying and auditing protection settings.

**Non-Goals:**

- Re-architecting release automation or changing npm publish semantics.
- Introducing broad CI matrix expansion (for example many Node versions) in this iteration.
- Changing lint rule behavior, package exports, or runtime behavior of the plugin.

## Decisions

### 1) Keep a single canonical PR gate workflow and make check names deterministic

Decision:

- Continue using `.github/workflows/test.yml` as the canonical PR validation workflow.
- Keep one required job name (for example `Test`) or rename once to a durable identifier and treat that name as part of branch governance contract.

Rationale:

- Reuses existing pipeline (`verify` + `test`) with minimal operational risk.
- Deterministic check names are required for reliable branch protection enforcement.

Alternatives considered:

- Split into many required jobs now: rejected for avoidable overhead in this scope.
- Add a second dedicated branch-protection workflow: rejected because it duplicates existing checks.

### 2) Enforce pull-request-only merges to `main` with required checks and review

Decision:

- Configure `main` protection to require pull requests, at least one approval, and passing required status checks.
- Require branches to be up to date before merge to avoid merging stale green checks.
- Enable stale approval dismissal when new commits are pushed to a PR.

Rationale:

- Prevents direct pushes and preserves code review discipline.
- Ensures merge commit reflects the code that was actually validated.

Alternatives considered:

- Required checks without required reviews: rejected as too weak for shared repository governance.
- Required reviews without up-to-date checks: rejected because stale checks can mask integration failures.

### 3) Treat branch protection/ruleset configuration as documented repo policy

Decision:

- Capture exact required settings in repository documentation for maintainers.
- Include guidance on how to safely update required checks when workflow/job names change.

Rationale:

- Branch protection state lives in GitHub settings and can drift unless explicitly documented.
- Documentation reduces accidental weakening during maintenance.

Alternatives considered:

- Keep settings implicit in admin knowledge: rejected due to bus-factor and drift risk.
- Rely only on default GitHub protections: rejected because defaults are not strict enough for intended policy.

## Risks / Trade-offs

- [Required check name drift] -> Mitigation: define stable required job identifier and update documentation whenever workflow names change.
- [Temporary maintainer friction from stricter gates] -> Mitigation: keep required checks minimal and aligned with existing CI runtime.
- [Protection settings divergence across environments] -> Mitigation: document exact settings and include periodic governance review in maintainer checklist.
- [False confidence if required checks are too coarse] -> Mitigation: ensure required job includes both `verify` and `test` commands.

## Migration Plan

1. Confirm or normalize PR workflow job naming so required checks are stable.
2. Apply `main` branch protection/ruleset settings with required PR review and status checks.
3. Update repository docs with branch protection policy and maintenance guidance.
4. Validate policy by opening a test PR and confirming merge is blocked until checks and review pass.

Rollback strategy:

- If enforcement blocks legitimate maintenance unexpectedly, temporarily relax only the specific failing protection rule while preserving PR-only merge policy, then restore after fix.

## Open Questions

- Should signed-commit and linear-history requirements be mandatory in this phase or deferred?
- Should the repository use classic branch protection or organization-level rulesets as the long-term control plane?
- Is one approval sufficient for all changes, or should sensitive workflow/config changes require higher review thresholds?

## Implementation Notes

- Applied `main` branch protection with required status check `PR Gate`, strict up-to-date checks, required PR reviews (1 approval), stale-review dismissal, and admin enforcement.
- Updated PR CI workflow naming to canonical `PR Gate` in `.github/workflows/test.yml` so required-check mapping is deterministic.
- Added maintainer governance documentation in `README.md` covering policy baseline, rename procedure, and audit commands.

## Follow-up Governance Questions

- Defer signed-commit and required linear history policy to a follow-up change after team agreement on contributor impact.
- Defer possible migration from classic branch protection to rulesets until organization-level governance requirements are defined.
- Keep minimum approval count at 1 for now; revisit higher thresholds for workflow/security-sensitive changes in follow-up.
