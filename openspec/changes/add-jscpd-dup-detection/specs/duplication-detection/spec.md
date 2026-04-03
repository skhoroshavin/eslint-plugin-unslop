## ADDED Requirements

### Requirement: Duplication detection runs in verification

The repository SHALL run jscpd as part of `npm run verify` so duplication checks execute anywhere the standard verification pipeline runs.

#### Scenario: Verify runs duplication checks

- **WHEN** a developer or CI executes `npm run verify`
- **THEN** the command SHALL invoke jscpd using the repository's `.jscpd.json` configuration

### Requirement: Duplication detection uses console-only reporting

The jscpd configuration SHALL report findings to console output and SHALL NOT require generated HTML report artifacts.

#### Scenario: Running jscpd does not require HTML artifacts

- **WHEN** jscpd runs with the repository configuration
- **THEN** findings SHALL be emitted via the console reporter
- **AND** HTML report output SHALL NOT be required for successful verification

### Requirement: Duplication scope targets production source files

The jscpd configuration SHALL focus detection on TypeScript source files under `src/` while excluding test files and common build output paths.

#### Scenario: Source-only duplication scope

- **WHEN** jscpd evaluates repository files
- **THEN** it SHALL include `src/**/*.ts`
- **AND** it SHALL exclude `node_modules`, `dist`, `out`, and test-file patterns such as `*.test.ts`
