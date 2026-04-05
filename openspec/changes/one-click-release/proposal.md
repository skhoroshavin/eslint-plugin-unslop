## Why

Releasing a new version currently requires manual local steps: edit `package.json`, commit, push a tag — error-prone and easy to get wrong. The goal is a single `workflow_dispatch` click in the GitHub UI (matching the `arbeitssuche` project pattern) that handles versioning, tagging, and npm publishing end-to-end.

## What Changes

- Replace the tag-triggered `release.yml` workflow with a `workflow_dispatch` workflow offering `patch / minor / major` bump selection
- Migrate main branch protection from classic rules to a GitHub ruleset that allows `github-actions[bot]` to push directly (bypassing the rule), while still blocking accidental human direct pushes
- Add `scripts/bump-version.ts` — a small script that increments the version in `package.json` and `package-lock.json`, commits, and returns the new version string for downstream steps
- No dev-version cycle (`x.y.z-dev`): the script bumps the current stable version directly to the next stable version

## Capabilities

### New Capabilities

- `release-process`: Automated one-click release via GitHub Actions `workflow_dispatch` — version bump, git tag, npm publish with OIDC provenance

### Modified Capabilities

_(none — no existing spec-level behavior changes)_

## Impact

- **`.github/workflows/release.yml`**: rewritten (trigger + job structure)
- **`scripts/bump-version.ts`**: new file
- **GitHub branch protection settings**: migrated from classic rules to ruleset (out-of-band infra change, not tracked in code)
- **No changes** to `src/`, rule logic, tests, or published API
- **Dependencies**: none added; `tsx` is already available via `npx` (used by arbeitssuche pattern); the publish step continues to use OIDC (`id-token: write`) — no new secrets required
