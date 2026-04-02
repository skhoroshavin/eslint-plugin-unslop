# Add jscpd duplication detection

Summary

- Add jscpd (JavaScript Copy/Paste Detector) to the repository and CI pipeline to detect code duplication in JS/TS sources. The initial integration will provide a reproducible local CLI command, a `package.json` script, a canonical `.jscpd.json` configuration, and a GitHub Actions job that produces machine-readable reports and an HTML artifact for human review.

Why

- Duplication increases maintenance cost and hides bugs; an automated detector prevents regressions and surfaces existing hotspots before they grow.
- jscpd is lightweight, popular in the JS/TS ecosystem, supports multiple reporters (json, html), and is easy to run locally or in CI.

Goals

- Provide a low‑friction developer experience for running duplication checks locally.
- Run duplication detection in CI for pull requests and surface results as artifacts/PR comments.
- Fail or warn CI based on tuned thresholds so we avoid noisy failures.

Non‑Goals

- Replace full code quality platforms (SonarCloud/SonarQube) — those remain optional future additions.
- Automatically fix duplication — detection only.

Success criteria

- `npm run check:dup` runs locally and produces `reports/jscpd/report.json` and `reports/jscpd/report.html`.
- CI runs jscpd on PRs and uploads HTML/JSON artifacts.
- Configured thresholds produce low false positives after one tuning pass (team agreement).

Rollout plan

1. Add `jscpd` as a devDependency and introduce `npm run check:dup` (non‑blocking by default).
2. Add a GitHub Actions job that runs jscpd and uploads reports; start with `continue-on-error: true` to gather data.
3. After 1–2 weeks of data and tuning, switch CI policy to fail PRs for clones above configured thresholds.

Risks and mitigation

- Noise from test fixtures or generated files — mitigate by excluding those paths in `.jscpd.json`.
- Legit duplicate boilerplate across small rule modules — mitigate by raising `minLines` (start at 6) and iteratively tuning.

Alternatives considered

- SonarCloud/SonarQube: richer dashboards and baselining, heavier setup and external service dependency.
- PMD/CPD: mature but less ergonomic for JS/TS projects compared to jscpd.

Files to add

- `package.json` script: `check:dup`
- `.jscpd.json` (repo config)
- `.github/workflows/jscpd.yml` (CI job)

Location

- Change artifacts created at `openspec/changes/add-jscpd-dup-detection/`.
