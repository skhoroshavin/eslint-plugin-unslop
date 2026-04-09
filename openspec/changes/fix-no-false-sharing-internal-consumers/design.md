## Context

`unslop/no-false-sharing` currently discovers exported symbol names from a shared entrypoint and then scans the source tree for import clauses whose resolved target is that entrypoint file. This works for public consumers but misses legitimate reuse inside the same shared module when a symbol is imported from an internal implementation file or from the shared entrypoint by another file in the same shared module. The result is false positives for shared barrels and direct entrypoint exports that are reused internally and externally.

The change must stay within the current rule architecture: string-based source scanning, tsconfig-aware path resolution, and directory-level consumer grouping. It must not weaken `import-control` by treating cross-module imports of internal files as valid sharing evidence.

## Goals / Non-Goals

**Goals:**

- Count same-shared-module internal reuse as a valid consumer signal for `no-false-sharing`.
- Collapse multiple internal consuming files in the same shared module into one internal consumer group.
- Preserve the existing threshold semantics so internal-only usage still reports the symbol.
- Support both direct entrypoint exports and re-exported symbols backed by internal files.

**Non-Goals:**

- Introduce full TypeScript symbol graph analysis or parser-service-based reference tracking.
- Change `import-control` boundary rules or allow cross-module imports of internal files.
- Expand false-sharing analysis beyond shared entrypoints and their exported symbols.

## Decisions

### Represent exported symbols as targets, not just names

The current rule reduces each export to a string name. The new design should track each exported symbol as a small descriptor with:

- the exported name
- the public entrypoint file
- an optional backing file when the symbol is re-exported from another file in the same shared module

This keeps direct entrypoint exports and re-exports in one model. Alternatives considered:

- Keep name-only tracking and special-case re-exports during scanning: rejected because it does not handle direct entrypoint exports consistently.
- Model multiple origins per symbol: rejected for now because the rule currently reasons at name granularity and does not distinguish value/type namespaces deeply enough to justify the extra complexity.

### Count two categories of usage

For each exported symbol, consumer discovery should count:

- public usage: imports resolving to the shared entrypoint file, grouped with the existing directory-based grouping
- internal usage: imports resolving to the symbol's backing file, or to the shared entrypoint file from another file in the same shared module, collapsed into one internal consumer group for that shared module instance

This preserves current behavior for external consumers while adding the missing internal signal. Alternatives considered:

- Count only direct entrypoint imports: rejected because it is the current false-positive source.
- Count every file in the shared module as a consumer: rejected because it treats existence as usage.

### Internal-only use remains insufficient

The rule should continue to require at least two total consumer groups. If the only usage is the collapsed internal group for the shared module itself, the symbol is still not truly shared and must be reported.

This keeps the rule aligned with its purpose: symbols exported from a shared entrypoint should justify public exposure by serving more than the module's own internals. Alternative considered:

- Treat internal reuse alone as enough to pass: rejected because it would encourage exporting symbols that should remain private to the shared module.

### Ignore boundary-violating external imports of internal files

If a file outside the shared module imports an internal implementation file directly, that edge must not satisfy false-sharing. Only public entrypoint imports and same-module internal reuse count.

This avoids rewarding architecture violations and keeps `no-false-sharing` aligned with `import-control`. Alternative considered:

- Count any resolved import of the backing file: rejected because it would make invalid imports help a symbol pass the rule.

## Risks / Trade-offs

- [Export origin discovery misses a barrel pattern] → Limit initial support to common patterns (`export const`, `export { x } from './file'`, and local import-then-export) and cover them explicitly in tests.
- [Internal consumer grouping becomes hard to explain in diagnostics] → Keep the existing message format unless the spec requires exposing the internal-group label.
- [String-based import scanning remains approximate] → Preserve the current scanning model and focus the change on target resolution and grouping semantics rather than parsing strategy.
- [Shared-module identity could drift from directory grouping rules] → Derive the collapsed internal group from the matched shared module instance so grouping stays aligned with architecture policy.
