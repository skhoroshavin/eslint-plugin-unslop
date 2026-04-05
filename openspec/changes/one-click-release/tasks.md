## 1. Branch Protection Migration

- [ ] 1.1 Create a new GitHub ruleset on `main`: block direct pushes, add `github-actions[bot]` (Integration) as a bypass actor
- [ ] 1.2 Verify the ruleset is active by attempting a direct push (should be rejected)
- [ ] 1.3 Delete (or disable) the existing classic branch protection rule

## 2. Bump Version Script

- [ ] 2.1 Create `scripts/bump-version.ts` — reads current version from `package.json`, applies `patch`/`minor`/`major` semver bump, writes updated version to `package.json` and `package-lock.json`, commits with message `"Bump version to X.Y.Z"`, and prints the new tag name to stdout
- [ ] 2.2 Validate the script locally: run `npx tsx scripts/bump-version.ts patch --no-git` and confirm the version in `package.json` increments correctly (use `--no-git` flag to skip commit for local testing)

## 3. Release Workflow

- [ ] 3.1 Rewrite `.github/workflows/release.yml` to use `workflow_dispatch` trigger with `bump` input (choices: `patch`, `minor`, `major`)
- [ ] 3.2 Add `contents: write` and `id-token: write` permissions
- [ ] 3.3 Add version job: checkout `main` with `DEPLOY_KEY` or default token (bot bypass via ruleset), run `npx tsx scripts/bump-version.ts ${{ inputs.bump }}`, tag and push with `--follow-tags`
- [ ] 3.4 Add publish job (after version): checkout at the new tag, run `npm run verify`, `npm run test`, then `npm publish` with `setup-node` pointing at `https://registry.npmjs.org` (OIDC — no token secret needed)
- [ ] 3.5 Add release job (after publish): use `softprops/action-gh-release` to create a GitHub release with `generate_release_notes: true` and `make_latest: true`
- [ ] 3.6 Pin all action references to full commit SHAs

## 4. Smoke Test

- [ ] 4.1 Trigger the workflow via the GitHub UI with `bump=patch` and confirm: version commit appears on `main`, tag is created, npm package is published, GitHub release is created
