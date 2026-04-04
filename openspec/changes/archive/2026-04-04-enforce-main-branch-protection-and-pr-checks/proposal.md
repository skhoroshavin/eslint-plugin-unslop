## Why

The repository already runs checks in GitHub Actions (`.github/workflows/test.yml`), but merge safety for `main` depends on convention rather than enforced repository policy. This change makes PR validation and branch protection explicit so `main` only advances through reviewed, passing pull requests.

## What Changes

- Define and document a required PR quality gate for `main` based on existing CI coverage (`npm run verify` and `npm run test`).
- Add explicit protection requirements for `main` (required status checks, pull request reviews, and up-to-date branches before merge).
- Align workflow check naming and job structure, where needed, so required checks are stable and easy to enforce in branch protection settings.
- Capture operational guidance for maintainers on how to manage branch protection/rulesets without weakening the guardrails.

## Non-goals

- Reworking the full release process or npm publishing automation.
- Adding new lint rules, runtime features, or package APIs.
- Introducing large CI matrix expansion beyond what is needed to enforce reliable PR gates.

## Capabilities

### New Capabilities

- `main-branch-pr-gates`: Defines enforceable requirements for pull-request validation and merge protection on `main`, including required checks and review constraints.

### Modified Capabilities

- None.

## Impact

- Affects GitHub repository governance (branch protection/rulesets) and CI workflow reliability for PR checks.
- May update `.github/workflows/test.yml` to ensure required-check identifiers remain deterministic.
- Does not change published plugin behavior, rule semantics, or public package interfaces.
