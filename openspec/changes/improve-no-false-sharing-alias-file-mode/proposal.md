## Why

`unslop/no-false-sharing` currently appears to count only relative imports and to evaluate sharing mainly at public entrypoints without symbol-level visibility. In codebases that use source-root aliases (`@/...`) and barrel exports, this can hide false sharing and make shared APIs look healthier than they are.

## What Changes

- Redefine `unslop/no-false-sharing` to enforce a single behavior: evaluate sharing at the symbol level for symbols publicly exported from shared-module entrypoints (`index.ts` / `types.ts`).
- Update consumer discovery so all local project imports that resolve to shared targets count as consumers, including alias-based imports such as `@/...`.
- Report failing symbols with actionable context: symbol name, consumer count, and the single detected consumer group when only one consumer exists.
- Keep false-sharing scope on public API symbols; internal unexported symbols remain outside this rule and can be handled through normal cleanup tooling.
- Update `unslop/import-control` to blanket-forbid `import * as X from '<local-project-module>'` for cross-module imports within the project, while keeping namespace imports from external dependencies unchanged.

## Non-goals

- Reworking unrelated architecture rules (`import-control`, `export-control`) beyond shared helper reuse required by this change.
- Implementing full type-aware dependency graphing via TypeScript program services.
- Introducing multiple runtime modes for `no-false-sharing`; this change defines one canonical behavior.
- Broad refactors outside false-sharing detection and its tests/spec updates.

## Capabilities

### New Capabilities

- `no-false-sharing-symbol-analysis`: Detect false sharing for publicly exported entrypoint symbols and report symbol-level diagnostics with consumer context.

### Modified Capabilities

- `architecture-import-export-control`: Update requirements so alias imports (for example `@/ui/components`, `@/utils/index.js`) count as local consumers for false-sharing analysis, and `import-control` forbids local cross-module namespace imports (`import * as ...`) while allowing external dependency namespace imports.

## Impact

- Affected code: `src/rules/no-false-sharing/*`, `src/rules/import-control/*`, and shared source-root import resolution utilities in `src/utils/*`.
- Behavior impact: repositories using aliases and barrels get accurate symbol-level false-sharing detection on public APIs, with diagnostics that identify likely consumer ownership.
- Tests/specs: add scenarios for alias-aware consumer counting, symbol-level reporting with single-consumer context, local cross-module namespace import rejection, and external namespace import allowance.
