## Why

The plugin currently catches several forms of dead or misleading code, but it does not flag module-scope constants that are effectively single-use aliases. Adding this rule now helps keep code direct and readable, while reusing the project's existing TypeScript-based analysis patterns for cross-file symbol lookup.

## What Changes

- Add a new `unslop/no-single-use-constants` rule that reports module-scope `const` declarations whose real usage count across the project is 0 or 1.
- Exclude destructured declarators and constants initialized with function or class expressions so the rule stays focused on inlineable values rather than named APIs.
- Count cross-file usages through TypeScript semantic symbol resolution while ignoring import and export-only positions that do not represent real consumption.
- Generalize TypeScript project-context discovery so rules outside the architecture rule set can safely reuse the same semantic project lookup and fallback behavior.

## Capabilities

### New Capabilities

- `no-single-use-constants`: Detect and report module-scope constants that are only used once across the project, with clear exclusions for non-inlineable declarations and import/export-only references.

### Modified Capabilities

- `tsconfig-resolution`: Expand the shared TypeScript project-context contract so semantic project discovery and caching are available to non-architecture rules that need cross-file symbol analysis.

## Impact

- Affected code: shared TypeScript project-context utilities, `no-false-sharing`'s internal project-context usage, a new rule implementation, and new rule tests.
- Affected APIs: plugin rule surface gains `unslop/no-single-use-constants` and related config wiring if recommended by the project.
- Dependencies and systems: continues to rely on the TypeScript compiler API and existing ESLint rule/test infrastructure.

## Non-goals

- Adding autofix support for single-use constants.
- Reporting non-`const` declarations, destructured bindings, or function/class expression declarations.
- Broad refactors to existing architecture-rule behavior beyond extracting the shared TypeScript project-context utility.
