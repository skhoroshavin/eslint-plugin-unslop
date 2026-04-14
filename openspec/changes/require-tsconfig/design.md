## Context

Architecture and semantic rules currently depend on `getTypeScriptProjectContext()` and `getArchitectureRuleState()`. When project context cannot be created (missing `tsconfig.json`, parse errors, or file outside project), rules often return early and act as no-ops, and `architecture-policy` only emits a one-time console warning. This creates false confidence in CI because violations can be skipped silently.

The proposal changes behavior to explicit lint failure for rules that require tsconfig-backed context (`import-control`, `no-false-sharing`, `no-single-use-constants`, `no-whitebox-testing`) and updates `plugin-configs` expectations accordingly.

## Goals / Non-Goals

**Goals:**

- Make missing or invalid TypeScript project context a reportable ESLint failure for rules that require it
- Keep failure behavior consistent across all impacted rules
- Preserve existing rule behavior when project context is valid
- Keep scope limited to semantic/architecture context handling and related specs/tests

**Non-Goals:**

- Redesigning architecture policy format or module matching semantics
- Changing detection heuristics unrelated to context acquisition
- Adding new top-level plugin configs or new independent capabilities

## Decisions

### 1) Represent context load failures as typed state, not `undefined`

Decision:

- Introduce a shared typed result for context-dependent rule setup (for example: `active`, `inactive`, `contextError`), where `contextError` carries a stable reason/message payload.

Rationale:

- Current `undefined` conflates "not applicable" (for example no matching architecture policy) with "required context missing/broken".
- Typed state keeps create() flows simple and avoids duplicated branching/error text across rules.

Alternatives considered:

- Keep `undefined` and add extra console warnings only: rejected because warnings do not fail lint.
- Throw runtime errors: rejected because rules should not crash lint execution and this breaks graceful ESLint integration.

### 2) Report a deterministic configuration error from each impacted rule

Decision:

- Each impacted rule adds one dedicated message id for missing/invalid tsconfig context and reports at file root (program node) when setup returns `contextError`.

Rationale:

- Keeps failures visible in normal ESLint output and CI exit code.
- Per-rule reporting preserves clear ownership (`unslop/import-control`, etc.) without inventing a new synthetic rule.

Alternatives considered:

- Add a standalone "preflight" rule that validates tsconfig once: rejected for this change because it introduces new capability surface and coupling beyond proposal scope.
- Reuse existing violation message ids: rejected because configuration failures should be distinguishable from code violations.

### 3) Centralize error reason construction in utility layer

Decision:

- Update shared tscontext/architecture utilities so they can return structured failure reasons (missing config, parse/read failure, file not in project), and let rules map that to user-facing messages.

Rationale:

- Prevents divergent interpretations across rules.
- Makes tests easier: scenarios can assert stable behavior by reason category.

Alternatives considered:

- Let each rule detect tsconfig failure independently: rejected due to duplication and higher drift risk.

### 4) Treat "file not included by discovered tsconfig" as configuration failure

Decision:

- For impacted rules, if a tsconfig is discovered but the linted file is outside the parsed project file set, return `contextError` instead of `inactive`.

Rationale:

- This indicates a broken or incomplete TypeScript project configuration for linted scope, not a valid out-of-scope condition.
- It prevents silent skips when CI lint targets files not covered by tsconfig includes/references.

Alternatives considered:

- Keep it inactive/no-op: rejected because it preserves the current hidden-failure problem.

### 5) Include path context in error messaging

Decision:

- Configuration error messages include actionable path details (for example linted filename, discovered tsconfig path or search root, and inclusion mismatch signal) while keeping message format deterministic for tests.

Rationale:

- Users need concrete diagnostics to fix tsconfig layout quickly.
- Rich error context reduces support churn and repeated trial-and-error configuration edits.

Alternatives considered:

- Minimal generic message only: rejected because it is hard to debug in multi-package/monorepo setups.

### 6) Preserve intentional no-op paths that are not misconfiguration

Decision:

- Keep no-op behavior for cases where a rule is legitimately out of scope (for example no architecture settings, file not recognized as test file, no matching module policy), and fail only when the rule needs semantic context but cannot obtain it.

Rationale:

- Avoids turning optional policy usage into mandatory configuration.
- Matches existing plugin-config contract: symbol-only usage still works, while architecture/semantic enforcement is strict once invoked.

Alternatives considered:

- Fail whenever architecture settings are absent: rejected because this would break optional adoption flows and exceeds proposal intent.

## Risks / Trade-offs

- [More lint failures for existing users] -> Provide precise, actionable error wording that points to `tsconfig.json` placement/validity.
- [Ambiguity between "file outside project" and "missing tsconfig"] -> Encode reason categories in utility return type and map to explicit messages.
- [Verbose errors become brittle in tests] -> Use stable message templates with structured path fields and assert key substrings in tests when appropriate.
- [Test churn across multiple rules/specs] -> Update specs first, then rule tests in small rule-by-rule commits to keep failures localized.
- [Potential duplicate reports per file] -> Emit one configuration report per rule invocation and return empty listeners afterward.

## Migration Plan

1. Update spec deltas for `import-control`, `no-false-sharing`, `no-single-use-constants`, `no-whitebox-testing`, and `plugin-configs` to replace no-op expectations with explicit failure scenarios.
2. Refactor shared context utilities to return structured context status (active/inactive/error) with reason details.
3. Update impacted rules to consume typed status and report deterministic configuration errors.
4. Update RuleTester scenarios currently asserting no-op on missing/invalid tsconfig.
5. Run targeted rule tests, then full `npm run test` and `npm run verify`.

Rollback:

- Revert utility/rule changes to previous `undefined` no-op behavior if needed; no data migration is involved.

## Open Questions

- None at this stage.
