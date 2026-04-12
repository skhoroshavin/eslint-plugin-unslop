## Context

`unslop/import-control` currently treats `index.ts` and `types.ts` as universal cross-module public entrypoints. That behavior is embedded in rule logic, so architecture settings can express import edges (`imports`) but cannot define each module's public import surface. This creates drift between intended architecture and enforced boundaries, especially for modules that want a different canonical entrypoint set.

The proposal introduces a module-level `entrypoints` field in `settings.unslop.architecture`. This change is localized to architecture config parsing and import-control boundary validation, and must preserve existing safety defaults for modules with partial or missing configuration.

## Goals / Non-Goals

**Goals:**

- Make cross-module entrypoint checks in `unslop/import-control` configuration-driven per module via `entrypoints: string[]`.
- Apply default `entrypoints` of `['index.ts']` when a module is configured but does not specify entrypoints.
- Keep unmatched (anonymous) modules deny-by-default for edge permissions and allow only `index.ts` as their cross-module entrypoint.
- Keep behavior deterministic and resilient when architecture config is incomplete.

**Non-Goals:**

- Changing semantics of `imports`, `exports`, or `shared` module policy fields.
- Adding glob/regex entrypoint matching or non-TypeScript entrypoint support.
- Revisiting unrelated import-control reports (namespace imports, same-module deep imports).

## Decisions

### 1) Add `entrypoints` to module policy normalization

The architecture settings parser will normalize each module policy to include resolved entrypoints. If `entrypoints` is omitted for a configured module, it resolves to `['index.ts']`.

Rationale:

- Keeps defaulting centralized and avoids duplicated fallback logic inside rule visitors.
- Preserves backward compatibility by giving legacy configs a strict but predictable default.

Alternatives considered:

- Keep parser unchanged and fallback only in import-control rule logic. Rejected because it scatters policy semantics and makes future policy consumers harder to implement consistently.

### 2) Keep unmatched modules on a stricter implicit policy

When importer/target does not match any configured module key, continue creating an anonymous module identity with empty `imports`, but treat allowed cross-module entrypoints as `['index.ts']` only.

Rationale:

- Aligns with proposal requirement to avoid broad implicit allowances.
- Prevents accidental deep or non-public cross-module coupling for unconfigured modules.

Alternatives considered:

- Reuse configured-module default and allow `types.ts` implicitly. Rejected because it weakens safe defaults for unconfigured architecture.

### 3) Compare resolved target file basename against allowed entrypoints

Import-control will continue using TypeScript semantic resolution for import target identity, then check the resolved target filename against the target module's allowed `entrypoints` set.

Rationale:

- Maintains existing correctness for alias paths and extensionless imports.
- Avoids fragile string matching against raw import specifiers.

Alternatives considered:

- Validate based on import specifier text. Rejected because aliases and TS resolution rules make specifier-based checks inaccurate.

### 4) Update tests to cover explicit, defaulted, and anonymous behavior

RuleTester scenarios will be updated/added so architecture-driven entrypoints are validated end-to-end:

- explicit module entrypoints allow and deny cases
- configured module fallback to `index.ts`
- unmatched module fallback to `index.ts` only

Rationale:

- The change is policy-sensitive; behavior should be asserted at rule boundary level.

## Risks / Trade-offs

- [Risk] Existing users relying on implicit `types.ts` entrypoint access without explicit config may see new violations → Mitigation: document default and require explicit `entrypoints` where needed.
- [Risk] Inconsistent normalization between rules if only import-control consumes `entrypoints` today → Mitigation: normalize in shared architecture parsing utilities, not inside one rule.
- [Risk] Filename-only matching could be ambiguous with unusual layouts → Mitigation: compare against resolved file basename in module context and keep test fixtures for nested paths.

## Migration Plan

1. Extend architecture config types/parsing to include normalized `entrypoints`.
2. Update import-control cross-module entrypoint validation to read normalized entrypoints from target module policy.
3. Add/adjust RuleTester scenarios for explicit and fallback behaviors.
4. Ship as a behavior change with release notes describing `entrypoints` and fallback semantics.

Rollback strategy:

- Revert parser and import-control changes together; tests for new entrypoint behavior should fail if rollback is partial.

## Open Questions

- None at this time.

Resolved decisions captured from review:

- Documentation should position `entrypoints` as an escape hatch; the default recommendation remains a simple `index.ts` entrypoint.
- Configured `entrypoints` values should be explicit filenames (for example `index.ts`). Import-control should continue to validate using the resolved target file, so specifier variants like `feature`, `feature/index`, `feature/index.js`, and `feature/index.ts` remain allowed when they resolve to the same configured entrypoint file.
