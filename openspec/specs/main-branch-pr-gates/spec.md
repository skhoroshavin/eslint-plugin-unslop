## ADDED Requirements

### Requirement: Main branch SHALL require pull request based merges

The repository SHALL enforce a protection policy on `main` that prevents direct pushes and requires merges through pull requests.

#### Scenario: Direct push to main is attempted

- **WHEN** a contributor attempts to push commits directly to `main`
- **THEN** the repository protection policy MUST reject the push

#### Scenario: Pull request merge is attempted

- **WHEN** a maintainer attempts to merge a pull request into `main`
- **THEN** the merge MUST be evaluated against all required branch protection conditions

### Requirement: Main branch SHALL require successful CI validation before merge

The repository SHALL require passing status checks from the canonical pull request CI workflow before a pull request can merge into `main`.

#### Scenario: Required CI check is failing

- **WHEN** at least one required pull request status check is failing
- **THEN** the pull request MUST remain unmergeable

#### Scenario: Required CI check is missing

- **WHEN** a pull request has not produced all required status checks
- **THEN** the pull request MUST remain unmergeable

#### Scenario: All required CI checks pass

- **WHEN** all required pull request status checks have completed successfully
- **THEN** CI validation MUST satisfy the branch protection check requirement

### Requirement: Main branch SHALL require code review approval

The repository SHALL require at least one pull request approval and SHALL invalidate stale approvals when new commits are added.

#### Scenario: Pull request has no approvals

- **WHEN** a pull request has not received the minimum required approvals
- **THEN** the pull request MUST remain unmergeable

#### Scenario: New commits are pushed after approval

- **WHEN** a pull request receives new commits after prior approval
- **THEN** stale approvals MUST be dismissed and fresh approval MUST be required before merge

### Requirement: Main branch SHALL require up-to-date pull request branches

The repository SHALL require pull request branches to be up to date with the target branch before merge.

#### Scenario: Pull request branch is behind main

- **WHEN** the pull request branch is not up to date with `main`
- **THEN** the pull request MUST remain unmergeable until updated and revalidated

#### Scenario: Pull request branch is up to date and validated

- **WHEN** the pull request branch is up to date with `main` and all other required conditions pass
- **THEN** branch freshness MUST satisfy the up-to-date merge condition

### Requirement: Branch protection policy SHALL be documented for maintainers

The repository SHALL document required `main` protection settings, required CI checks, and maintainer guidance for safe policy updates.

#### Scenario: Maintainer updates workflow check names

- **WHEN** a maintainer changes workflow or job names used for required status checks
- **THEN** maintainer guidance MUST instruct updating required-check mappings to keep merge protection effective

#### Scenario: Maintainer audits repository protections

- **WHEN** a maintainer reviews repository governance settings
- **THEN** documentation MUST provide explicit expected `main` protection requirements for verification
