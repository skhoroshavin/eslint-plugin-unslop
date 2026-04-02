# Design: jscpd duplication detection

Overview

- Use jscpd (https://github.com/kucherenko/jscpd) to detect copy/paste clones across the repository's JavaScript and TypeScript sources. Provide a stable configuration file, `package.json` scripts for local use, and a GitHub Actions job to run on pull requests and main.

Components

- `.jscpd.json` - repository configuration (excludes, minLines, reporters, output dir)
- `package.json` - script `check:dup` that runs jscpd with the repo config and writes reports to `reports/jscpd`
- `ci` - GitHub Actions workflow `jscpd.yml` that runs `npm ci` and `npm run check:dup`, then uploads `reports/jscpd` as workflow artifacts and optionally posts a PR comment or annotation (initial iteration just uploads artifacts).

Configuration details

- minLines: 6 (adjustable after observing noise)
- languages: javascript, typescript
- excludes: `node_modules`, `dist`, `reports`, `.opencode`, test fixtures directory patterns (e.g., `**/__fixtures__/**`, `**/fixtures/**`), `**/*.d.ts`
- reporters: `json`, `html`
- output: `reports/jscpd`

CI behavior

- Job runs on `pull_request` and `push` to main (or default branch).
- Steps:
  1. Checkout
  2. Setup Node 18
  3. Install dev dependencies (`npm ci`)
  4. Run `npm run check:dup`
  5. Upload `reports/jscpd` as artifact for review
- For the first iteration the job will not fail PRs (use `continue-on-error: true`). After tuning, flip to fail based on thresholds and/or script exit code.

Reporting & triage

- `reports/jscpd/report.html` is the human‑facing artifact reviewers can open.
- `reports/jscpd/report.json` can be consumed by automation that posts PR comments or generates annotations; that is a later enhancement.

Threshold strategy

- Start: do not fail PRs automatically; just report.
- Tune `minLines` and exclusions until noise is low.
- Enforce: fail only when clone size >= 15 lines or overall duplication percent > 2% (team can adjust).

Extensibility

- Replace report upload with PR annotation using a small Node script or GitHub Action that parses `report.json` and uses `gh` to comment/annotate.
- If the team wants historical trending, add SonarCloud and import jscpd results or let Sonar compute duplication metrics.
