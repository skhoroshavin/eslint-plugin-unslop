## Context

`unslop/import-control` already uses the TypeScript semantic project plus shared architecture policy to resolve import targets, identify module instances, and enforce cross-module entrypoint boundaries. Inside a single module instance, its same-module behavior is intentionally narrow: it only rejects imports that go too many levels deeper.

That leaves a gap for tests that live beside a module's implementation files. A test such as `module/some.test.ts` can currently import `./model.ts` directly even when the module's public contract is `./index.ts`. The requested rule closes that gap without taking over `import-control` responsibilities for cross-module or child-submodule imports.

## Goals / Non-Goals

**Goals:**

- Enforce black-box testing for test files by rejecting imports of private sibling files from the same module directory.
- Reuse the existing architecture policy and TypeScript-based resolution flow so relative and alias imports are treated consistently.
- Allow imports that target the current module's configured public entrypoints.
- Ignore imports that should remain governed by `unslop/import-control`, including cross-module imports and imports into child submodules.

**Non-Goals:**

- Changing `unslop/import-control` behavior or moving same-module depth checks into the new rule.
- Inferring public API from exported symbols; the rule only cares about configured entrypoint files.
- Enforcing this restriction for non-test files.
- Adding new architecture configuration beyond existing `entrypoints` support.

## Decisions

### 1. Scope the rule to test files and import declarations only

The rule will run only for files that match the supported test naming conventions: `*.test.*`, `*.spec.*`, `*.*-test.*`, and `*.*-spec.*`. It will inspect `ImportDeclaration` nodes, which is sufficient for the stated white-box testing problem and matches how the example imports are expressed.

Why this approach:

- It stays aligned with the test naming conventions this repository wants to recognize and with existing RuleTester scenarios.
- It avoids broadening the rule into general intra-module dependency control.

Alternative considered:

- Supporting every possible test-file convention up front. Rejected for v1 because the requested set is explicit and broad enough for current usage, and even looser detection would increase accidental matches.

### 2. Reuse architecture and semantic resolution helpers instead of path-only heuristics

The rule should obtain architecture state the same way `import-control` does, then resolve each import through the TypeScript semantic project before matching the target file back to an architecture module. This keeps alias imports, extension variants, and configured `entrypoints` behavior consistent with the rest of the plugin.

Why this approach:

- It avoids a second, slightly different implementation of module matching.
- It ensures `'.'`, `'./index'`, `'./index.ts'`, and configured entrypoint equivalents are judged against the same resolved file identity.
- It preserves fail-open behavior when architecture settings or semantic project data are unavailable.

Alternative considered:

- Using only the raw import specifier string. Rejected because it would be brittle around tsconfig path aliases, omitted extensions, and entrypoint normalization.

### 3. Report only same-directory private imports within the current module

The rule will report an import when all of the following are true:

- the importing file is a test file
- the import resolves into the same architecture module instance as the test file
- the resolved target file is in the same directory as the test file
- the resolved target file's basename is not one of the current module's allowed `entrypoints`

This makes `./model` invalid from `module/some.test.ts`, while leaving `./submodule`, `./submodule/index`, and `./submodule/other.ts` alone because those targets are not sibling files in the test file's directory.

Why this approach:

- It matches the requested behavior precisely.
- It avoids overlap with `import-control`, which already governs cross-module edges and child-module entrypoints.
- It keeps the rule conceptually simple: tests may use the module API, not same-folder internals.

Alternative considered:

- Banning every same-module non-entrypoint import from tests. Rejected because it would start policing submodule imports that the change explicitly leaves to existing architecture rules.

### 4. Use a dedicated rule with a targeted white-box-testing message instead of expanding `import-control`

The implementation should live in `src/rules/no-whitebox-testing/` as a standalone rule with its own tests and registration entry. The report message should explain that tests must import the module through its public entrypoint rather than a private sibling file, and it should include the offending import specifier so the failure points directly at the problematic statement.

Why this approach:

- The violation is test-specific and conceptually different from general module-boundary enforcement.
- A dedicated rule keeps `import-control` focused on architecture edges and avoids adding more branching to an already central rule.

### 5. Ship the rule in the plugin's full ruleset

`unslop/no-whitebox-testing` should be wired into the plugin's full ruleset rather than left as opt-in only.

Why this approach:

- The rule enforces the repository's preferred black-box testing discipline and closes a gap in the current architecture story.
- Shipping it in the full ruleset makes the behavior discoverable and consistent for users who adopt the plugin's opinionated configuration.

Alternative considered:

- Leaving the rule opt-in only. Rejected because the requested behavior is part of the intended architecture policy, not an experimental niche check.

Alternative considered:

- Extending `import-control` with a test-only branch. Rejected because it would mix separate concerns and make future changes harder to reason about.

## Risks / Trade-offs

- [Test-file detection is convention-based] -> Limit v1 to the explicit supported patterns (`*.test.*`, `*.spec.*`, `*.*-test.*`, `*.*-spec.*`) and cover each pattern in end-to-end scenarios.
- [Same-directory focus is intentionally narrow] -> Keep the rule narrow because deeper or child-module imports are already covered by architecture policy; add follow-up behavior only if a real gap remains after adoption.
- [Rule depends on architecture + semantic project state] -> Reuse the existing fail-open pattern so the rule does not throw or produce noisy false positives when project context is unavailable.
- [Adding the rule to the full ruleset may surface new violations in adopters] -> Keep the behavior narrow to same-directory private imports in test files and make the report point at the offending import specifier.

## Migration Plan

1. Add the new rule implementation and end-to-end RuleTester coverage.
2. Register the rule in the plugin's public rule map and wire it into the full ruleset.
3. Document the supported test-file patterns and the intended public-entrypoint-only behavior for tests.
4. Roll back by removing the rule from the full ruleset and reverting the rule registration if needed. No persisted data or code migration is involved.

## Open Questions

- None at this stage.
