## Context

The current release flow is tag-triggered: a developer manually edits `package.json`, commits, pushes a `vX.Y.Z` tag, and the workflow fires. This is fragile — wrong version, forgotten tag, mismatched commit message.

The `arbeitssuche` sibling project already uses a `workflow_dispatch` pattern that works well. The constraint here is that `eslint-plugin-unslop/main` has classic branch protection with `enforce_admins: true`, which blocks direct bot pushes. `arbeitssuche/main` is unprotected.

## Goals / Non-Goals

**Goals:**

- Single GitHub UI action (Actions → Release → Run workflow → pick bump type) triggers the full release
- The bot can push the version bump commit + tag to main
- Human direct pushes to main remain blocked
- OIDC-based npm publish (no new secrets)
- No dev-version cycle — stable-to-stable bumps only

**Non-Goals:**

- Changelog generation beyond GitHub's auto-generated release notes
- Multi-platform build artifacts (this is an npm-only package)
- Canary / pre-release version support
- Automating the branch protection migration itself (done once manually)

## Decisions

### 1. Ruleset over classic branch protection

**Decision:** Migrate from classic branch protection to a GitHub ruleset.

**Rationale:** Classic branch protection with `enforce_admins: true` has no bypass-actor concept — it blocks everyone including admins and bots. GitHub rulesets (available on all plans) support a bypass list. Adding `github-actions[bot]` (role: "Integration") as a bypass actor lets the release workflow push directly while the rule still blocks human direct pushes.

**Alternative considered:** Disable `enforce_admins` on the existing classic rule and use a deploy key. Rejected — deploy keys require managing an SSH keypair and an additional repo secret; rulesets are cleaner and free.

### 2. Simplified bump script (no dev cycle)

**Decision:** `scripts/bump-version.ts` takes the current stable version and bumps it directly to the next stable version. No `-dev` suffix.

**Rationale:** The dev-version pattern in `arbeitssuche` signals "work in progress since last release" but adds complexity (two commits per release, bootstrap step). For an npm plugin where the version in `package.json` on main is less meaningful than the published npm version, the simpler model is preferred.

**Version format:** `MAJOR.MINOR.PATCH` strictly. Script validates input matches this before proceeding.

### 3. Single job in release workflow

**Decision:** One job: bump → tag → verify → publish → GitHub release. No job matrix.

**Rationale:** Unlike `arbeitssuche` (native binaries per platform), this package has no platform-specific build step. Everything runs on `ubuntu-latest`. Splitting into multiple jobs would only add latency and complexity.

### 4. `npx tsx` for the bump script

**Decision:** Run the bump script with `npx tsx scripts/bump-version.ts` (no `tsx` in `devDependencies`).

**Rationale:** `tsx` is already used this way in `arbeitssuche`. Avoids adding a dev dependency just for a CI utility script. `npx` fetches and caches it automatically.

### 5. Pinned action SHAs in release workflow

**Decision:** Pin `actions/checkout` and `actions/setup-node` to full commit SHAs (like `arbeitssuche`), not floating tags.

**Rationale:** Supply-chain hygiene. The release workflow has `contents: write` and `id-token: write` — elevated permissions worth protecting.

## Risks / Trade-offs

- **Ruleset misconfiguration** → Mitigation: test with a throwaway push before relying on it; the classic rule stays in place until the ruleset is verified.
- **`npx tsx` network fetch fails in CI** → Mitigation: `npx` caches; extremely rare. If it becomes a problem, add `tsx` to `devDependencies`.
- **Bot push rejected if ruleset bypass isn't set correctly** → Mitigation: the workflow will fail loudly at the push step; no partial release (tag not created yet at that point).
- **`npm run verify` failure blocks release mid-flight** → This is intentional — a failed verify means the release doesn't happen. The version commit will have been pushed but no tag, so it can be reverted or the fix can be committed before re-running.

## Migration Plan

1. Create the GitHub ruleset via UI: block direct pushes on `main`, add `github-actions[bot]` as bypass actor (Integration type)
2. Delete (or disable) the existing classic branch protection rule
3. Add `scripts/bump-version.ts`
4. Replace `.github/workflows/release.yml`
5. Verify with a patch release
