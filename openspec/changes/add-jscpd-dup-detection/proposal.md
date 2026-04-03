# Add jscpd duplication detection

Summary

- Add jscpd (JavaScript Copy/Paste Detector) to the repository verification flow to detect code duplication in source files. The integration provides a canonical `.jscpd.json` configuration and runs jscpd from `npm run verify` with console output.

Why

- Duplication increases maintenance cost and hides bugs; an automated detector prevents regressions and surfaces existing hotspots before they grow.
- jscpd is lightweight, popular in the JS/TS ecosystem, and easy to run locally or in CI.

Goals

- Provide a low‑friction developer experience for running duplication checks locally.
- Run duplication detection in CI through the existing `verify` pipeline.
- Keep output focused and actionable while avoiding generated report artifacts in the repo.

Non‑Goals

- Replace full code quality platforms (SonarCloud/SonarQube) — those remain optional future additions.
- Automatically fix duplication — detection only.

Success criteria

- `npm run verify` runs jscpd as part of the standard verification pipeline.
- jscpd uses console reporting only and does not generate tracked report artifacts.
- Configured thresholds produce low false positives after one tuning pass (team agreement).

Rollout plan

1. Add `jscpd` as a devDependency with a repo-level `.jscpd.json` configuration.
2. Integrate `jscpd` into the existing `verify` script so duplication checks run in CI without adding a new workflow.
3. After 1–2 weeks of data and tuning, adjust thresholds/exclusions based on observed noise.

Risks and mitigation

- Noise from test files or generated files — mitigate by excluding those paths in `.jscpd.json`.
- Legit duplicate boilerplate across small rule modules — mitigate by raising `minLines` (start at 6) and iteratively tuning.

Alternatives considered

- SonarCloud/SonarQube: richer dashboards and baselining, heavier setup and external service dependency.
- PMD/CPD: mature but less ergonomic for JS/TS projects compared to jscpd.

Files to add

- `package.json` update: include `jscpd` in `verify`
- `.jscpd.json` (repo config)

Location

- Change artifacts created at `openspec/changes/add-jscpd-dup-detection/`.
