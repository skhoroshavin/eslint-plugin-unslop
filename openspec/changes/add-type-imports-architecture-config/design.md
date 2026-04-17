## Context

`architecture-policy.ts` is the shared parser and data model for `settings.unslop.architecture`. Today each module policy exposes `imports`, `exports`, `entrypoints`, and `shared`, with missing list fields normalizing to empty arrays and missing `entrypoints` defaulting to `['index.ts']`. `import-control` consumes that shared policy and currently applies the same `imports` allowlist to every cross-module declaration it checks.

This change is cross-cutting because it updates the shared architecture config contract and the rule that consumes it. The implementation needs to preserve existing runtime-boundary behavior, keep omitted configuration backward-compatible, and fit within the repository's small-function and low-complexity guardrails.

## Goals / Non-Goals

**Goals:**

- Extend shared architecture policy parsing with an optional `typeImports` allowlist that defaults to an empty list.
- Keep current value-import behavior unchanged so existing `imports` semantics remain the source of truth for runtime dependencies.
- Allow type-only cross-module imports when the target matches either `imports` or `typeImports`.
- Cover the new behavior with end-to-end RuleTester scenarios for both shared config parsing and `import-control` enforcement.

**Non-Goals:**

- Changing `exports`, `entrypoints`, selector parsing, or anonymous-module behavior.
- Introducing a separate matcher syntax for `typeImports`; it should reuse the existing import pattern matching rules.
- Relaxing non-type cross-module imports or changing namespace-import handling.
- Refactoring unrelated architecture helpers or rule structure beyond what is needed for this behavior.

## Decisions

### Add `typeImports` to the shared module policy shape

`ArchitectureModulePolicy` and the matching test-fixture policy type will gain a `typeImports: string[]` field. Parsing will use the same `readStringList()` helper as `imports`, so invalid or omitted values normalize to `[]` rather than producing a new configuration error.

This keeps the change backward-compatible and follows the existing policy-field conventions. The alternative was to infer type-only allowances from `imports` alone or add a nested policy object, but both options either fail to solve the use case or add unnecessary config complexity.

### Reuse the existing pattern matcher for both allowlists

`typeImports` should use the same exact, `/*`, and `/+` matching semantics already implemented by `importPatternMatches()`. `import-control` should decide which allowlists apply based on whether the declaration is type-only, then delegate matching to the existing helper.

This avoids duplicating wildcard logic and keeps architecture policy semantics uniform across value and type edges. A separate `typeImports` matcher syntax was rejected because it would make the shared config harder to learn and document.

### Classify declarations by whether the edge is type-only

`import-control` should introduce a small helper that determines whether the current declaration is type-only. The helper should recognize declaration-level type syntax and specifier-level type-only syntax so `import type { Foo } from 'x'` and `import { type Foo } from 'x'` are both treated as type-only edges when the declaration has no value imports.

Using declaration classification keeps the main boundary check readable and avoids threading parser-specific checks through multiple branches. The alternative was to keep a simpler declaration-level check only, but that would incorrectly treat specifier-level type-only imports as value imports.

### Preserve entrypoint and namespace rules after allowlist selection

Once a cross-module edge is allowed by the appropriate allowlist, the rule should continue to enforce the existing entrypoint check and local namespace-import restriction exactly as it does today. `typeImports` only changes whether the cross-module edge is declared, not whether internal files or namespace imports are permitted.

This keeps the scope narrow and aligned with the proposal. Broadening `typeImports` to bypass entrypoint rules was rejected because it would introduce a second axis of visibility and effectively create a new public-surface model.

## Risks / Trade-offs

- [Type-only syntax detection differs across AST shapes] -> Mitigation: cover both declaration-level and specifier-level type-only import syntax in RuleTester scenarios before implementation is considered complete.
- [Shared policy shape changes may require fixture updates outside `import-control`] -> Mitigation: keep the new field optional with an empty default so existing tests and rules do not need configuration changes.
- [Future architecture-aware rules may interpret `typeImports` inconsistently] -> Mitigation: define the field in `architecture-config` specs as import-control-facing shared policy semantics so later consumers can intentionally opt in rather than inheriting ambiguous behavior.

## Migration Plan

No migration step is required. Existing configurations continue to behave the same because omitted `typeImports` resolves to an empty list. Users can opt in incrementally by adding `typeImports` to selected architecture policies.

Rollback is straightforward: remove the new field from configuration and revert the implementation if needed.

## Open Questions

- None at the design stage. The remaining work is to codify the exact requirements in the `architecture-config` and `import-control` spec deltas.
