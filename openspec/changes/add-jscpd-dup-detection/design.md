# Design: jscpd duplication detection

Overview

- Use jscpd (https://github.com/kucherenko/jscpd) to detect copy/paste clones across repository source files. Provide a stable configuration file and run it from the existing `verify` script.

Components

- `.jscpd.json` - repository configuration (mode, thresholds, scope, and ignore rules)
- `package.json` - `verify` script includes `jscpd`

Configuration details

- mode: `mild`
- threshold: `0`
- reporters: `console`
- minTokens: `60`
- minLines: `5`
- format: `typescript`
- pattern: `src/**/*.ts`
- ignores: `node_modules`, `dist`, `out`, test files (`*.test.ts`, `*.test-suite.ts`, `*.integration-test.ts`)
- gitignore-aware: `true`
- absolute paths in output: `false`

CI behavior

- Duplication detection runs where `npm run verify` runs.
- No additional workflow is required for jscpd.

Reporting & triage

- jscpd writes findings to console output during `verify`.
- If machine-readable reports become necessary later, reporters can be expanded in `.jscpd.json`.

Threshold strategy

- Start with strict detection (`threshold: 0`) while scoping checks to `src/**/*.ts` and excluding test files.
- Tune `minTokens`, `minLines`, and ignore patterns until noise is low.

Extensibility

- Add a dedicated script or workflow only if the team later wants PR annotations.
- If the team wants historical trending, add SonarCloud and import jscpd results or let Sonar compute duplication metrics.
