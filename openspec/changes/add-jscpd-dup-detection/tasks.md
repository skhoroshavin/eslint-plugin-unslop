# Tasks: add jscpd duplication detection

1. Add jscpd config and package script

- Create `.jscpd.json` with excludes, `minLines: 6`, reporters `json,html`, output `reports/jscpd`.
- Add `check:dup` script to `package.json`: `jscpd --config .jscpd.json`.

2. Add GitHub Actions workflow

- Create `.github/workflows/jscpd.yml` to run on `pull_request` and `push` to `main`.
- Steps: checkout, setup-node@v4 (node 18), npm ci, npm run check:dup, upload-artifact `reports/jscpd`.
- Set `continue-on-error: true` initially.

3. Run experiment & tune

- Run the job for several PRs (or trigger manually) to collect reports.
- Triage noise and update `.jscpd.json` excludes and `minLines`.

4. Enforce policy

- Decide fail criteria (e.g., any clone >= 15 lines or dup% > 2%).
- Modify the CI job to fail when thresholds are exceeded and/or update `verify` script to include `check:dup`.

5. (Optional) PR annotations

- Implement a small script or use community actions to parse `reports/jscpd/report.json` and post annotations/comments to the PR with the highest risk clones.
