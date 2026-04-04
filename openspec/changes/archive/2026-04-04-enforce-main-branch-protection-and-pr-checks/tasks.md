## 1. Stabilize PR CI checks for branch protection

- [x] 1.1 Review `.github/workflows/test.yml` triggers and job names, then normalize naming so required checks are deterministic.
- [x] 1.2 Ensure the required PR job executes both `npm run verify` and `npm run test` in a stable sequence.
- [x] 1.3 If workflow naming changes, update related repository docs so required-check mapping remains accurate.

## 2. Configure `main` branch protection policy

- [x] 2.1 Configure `main` to require pull requests and block direct pushes.
- [x] 2.2 Configure required status checks for the canonical PR CI job(s) and require branches to be up to date before merge.
- [x] 2.3 Configure review enforcement with at least one approval and stale approval dismissal on new commits.

## 3. Document maintainer governance guidance

- [x] 3.1 Add or update repository documentation describing the `main` protection baseline and required PR checks.
- [x] 3.2 Document safe maintenance procedure for workflow/job renames, including required-check mapping updates in GitHub settings.
- [x] 3.3 Document branch-protection auditing steps maintainers can run periodically.

## 4. Validate and hand off

- [ ] 4.1 Open a validation PR to confirm merge is blocked until required checks and approval are satisfied.
- [x] 4.2 Run `npm run verify` and `npm run test` locally (or confirm passing in CI) after workflow updates.
- [x] 4.3 Capture final policy state in the change notes and close any open governance questions for follow-up.
