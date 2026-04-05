## ADDED Requirements

### Requirement: Workflow is triggered manually via GitHub UI

The release workflow SHALL be triggered via `workflow_dispatch` with a single required input: `bump` (choice of `patch`, `minor`, or `major`). No other trigger SHALL initiate a release.

#### Scenario: Trigger appears in GitHub Actions UI

- **WHEN** a user navigates to Actions → Release in the GitHub UI
- **THEN** a "Run workflow" button is present with a `bump` dropdown offering `patch`, `minor`, and `major`

### Requirement: Version is bumped atomically before publishing

The workflow SHALL increment the version in `package.json` and `package-lock.json` according to the selected bump type, commit that change to `main`, and create an annotated git tag — all before any publish step runs.

#### Scenario: Patch bump from 0.2.1

- **WHEN** the workflow runs with `bump=patch` and current version is `0.2.1`
- **THEN** `package.json` version becomes `0.2.2`, a commit "Bump version to 0.2.2" is pushed to `main`, and tag `v0.2.2` is created

#### Scenario: Minor bump from 0.2.1

- **WHEN** the workflow runs with `bump=minor` and current version is `0.2.1`
- **THEN** `package.json` version becomes `0.3.0` and tag `v0.3.0` is created

#### Scenario: Major bump from 0.2.1

- **WHEN** the workflow runs with `bump=major` and current version is `0.2.1`
- **THEN** `package.json` version becomes `1.0.0` and tag `v1.0.0` is created

### Requirement: Bot can push to protected main branch

The GitHub repository's main branch protection SHALL be implemented as a ruleset that blocks direct pushes from human actors but grants bypass access to `github-actions[bot]`, allowing the release workflow to commit and tag without a PR.

#### Scenario: Release workflow pushes version bump commit

- **WHEN** the release workflow runs `git push origin main --follow-tags`
- **THEN** the push succeeds and both the version bump commit and the tag appear on `main`

#### Scenario: Human attempts direct push to main

- **WHEN** a developer runs `git push origin main` directly (not via a PR)
- **THEN** the push is rejected by the branch ruleset

### Requirement: Quality gates pass before publishing

The workflow SHALL run `npm run verify` and `npm run test` after tagging and before publishing to npm. A failure in either SHALL abort the release without publishing.

#### Scenario: Verify fails before publish

- **WHEN** `npm run verify` exits with a non-zero code
- **THEN** the workflow fails and no npm publish is attempted

#### Scenario: Tests fail before publish

- **WHEN** `npm run test` exits with a non-zero code
- **THEN** the workflow fails and no npm publish is attempted

### Requirement: Package is published to npm with OIDC provenance

The workflow SHALL publish the package to the npm registry using OIDC-based authentication (no `NODE_AUTH_TOKEN` secret required). The published package SHALL include a signed provenance statement.

#### Scenario: Successful publish with provenance

- **WHEN** all quality gates pass and `npm publish` runs
- **THEN** the package is published to npm and the output includes "Signed provenance statement"

### Requirement: GitHub release is created automatically

After a successful publish, the workflow SHALL create a GitHub release for the tag with auto-generated release notes.

#### Scenario: Release appears on GitHub after workflow completes

- **WHEN** the workflow completes successfully
- **THEN** a GitHub release exists for the new tag with auto-generated notes and is marked as latest
