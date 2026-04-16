## Context

The current architecture matcher applies configuration keys directly to source-relative file paths. That makes the meaning of a key depend on concrete filenames, forces configs to repeat both parent and child selectors such as `models` and `models/*`, and creates incorrect matches such as `models/*` effectively covering `models/index.ts`. The change proposal also removes file-shaped keys, so architecture-aware rules need a single directory-shaped module model that can be shared across `import-control` and the other rules that already consume architecture policy.

The existing implementation already centralizes architecture parsing and match selection in `src/utils/architecture-policy.ts`, so this change should keep that shared entry point and replace the matching model behind it rather than creating rule-specific logic.

## Goals / Non-Goals

**Goals:**

- Resolve files to canonical module paths before any policy matching happens.
- Define clear but different semantics for architecture keys and import allowlists, so policy ownership can flow down a subtree while dependency permissions remain explicit.
- Make selector precedence deterministic and easy to explain.
- Remove file-shaped architecture keys and migrate key-matching semantics out of rule-specific specs into `architecture-config`.
- Preserve the existing deny-by-default posture for unmatched modules.

**Non-Goals:**

- Add recursive matching or any syntax equivalent to arbitrary-depth descendants.
- Add policy inheritance or merging across overlapping selectors.
- Redesign rule-specific behavior unrelated to architecture matching, such as export contracts or false-sharing thresholds.

## Decisions

### 1. Resolve files to canonical module paths first

Architecture matching will become a two-step process:

1. Normalize the linted file to a source-relative path.
2. Resolve that file to a canonical module path equal to its containing directory.
3. Match architecture selectors against the canonical module path.

Canonical module path resolution is configuration-independent. A file belongs to the module named by its containing directory, relative to the source root. Source-root files belong to the source-root module `.`.

Examples:

- `src/models/index.ts` -> `models`
- `src/models/a/index.ts` -> `models/a`
- `src/models/a/private.ts` -> `models/a`
- `src/models/a/internal/x.ts` -> `models/a/internal`
- `src/index.ts` -> `.`

If no configured selector matches that canonical module path, the file remains in an anonymous module keyed by that canonical path. That preserves the current deny-by-default behavior without requiring explicit config for every directory.

Alternatives considered:

- Match selectors directly against raw file paths: rejected because it preserves the current ambiguity and the `models/*` vs `models/index.ts` bug.
- Derive module identity from the nearest matching selector: rejected because module identity should not change based on which selectors happen to exist in config.
- Derive module identity from the winning selector string: rejected because it makes allowlists depend on configuration shape instead of the actual module being imported.

### 2. Directory-shaped selectors only

Architecture keys will only describe directory-shaped modules. File-shaped keys such as `index.ts` and `rules/public.ts` will become invalid configuration.

This change makes module identity stable across all files inside a module and removes the need to reason about whether a key names a file, a directory, or an entrypoint.

Alternatives considered:

- Keep file-shaped keys for backward compatibility: rejected because it preserves the mixed file/module model and complicates canonical module resolution.
- Add a second explicit syntax for file modules: rejected because the user explicitly does not want file-shaped module keys and the current change is intended to simplify, not expand, the selector model.

### 3. Keys assign policy to subtrees, imports remain narrow

Architecture keys and `imports` values will no longer have identical semantics.

For architecture keys:

- `foo`: owns `foo` and all descendants under `foo`
- `foo/*`: owns each direct child subtree under `foo`, such as `foo/a` and `foo/a/internal`
- exact child keys such as `foo/a`: own that named subtree and override broader keys where they overlap

`+` is not needed for keys under this model and will not be supported in architecture keys.

For `imports` allowlists:

- `foo`: exact module only
- `foo/*`: `foo/<one-segment>` only
- `foo/+`: `foo` or `foo/<one-segment>`

`+` remains intentionally limited to depth `0..1`. It is not recursive and is only valid as the terminal segment of an allowlist pattern.

This split keeps policy assignment ergonomic without making import permissions implicit.

Examples:

- `src/models/a/internal/x.ts` has canonical module path `models/a/internal`
- key `models` covers it
- key `models/*` also covers it via child `a`
- key `models/a` covers it more specifically and therefore wins if present

Alternatives considered:

- Use `**` for `self-or-child`: rejected because `**` normally implies recursion and this change intentionally avoids recursive semantics.
- Keep identical semantics for keys and imports: rejected because subtree ownership is useful for policy assignment, while dependency permissions should stay explicit and non-recursive.

### 4. Precedence is based on concreteness first, then path length

When multiple architecture keys cover the same canonical module path, the winner is chosen by:

1. More specific subtree owner wins
2. Exact named path beats wildcard path at the same depth
3. Longer selector path wins when still tied
4. Earlier declaration order is the final tiebreaker

Examples:

- `models/a` beats `models/*` for `models/a`
- `models/*` beats `models` for `models/b`
- `models/a` beats `models/*` for `models/a/internal`
- `ui/views/job-search` beats `ui/views/*` for `ui/views/job-search/editor`

This keeps the rule simple: broader keys provide defaults for a subtree, and more specific keys take over locally without introducing merge semantics.

Alternatives considered:

- Longest string only: rejected because exact named child selectors should outrank wildcard child selectors for the same subtree.
- Merge all matching policies: rejected because merge behavior would be hard to explain for `imports`, `entrypoints`, and `shared`.

### 5. Import allowlists match canonical target module paths, not winning key names

`import-control` should evaluate `imports` entries against the target module's canonical module path. The allowlist should not depend on whether the target is configured via `models`, `models/*`, or `models/a`.

This lets configuration express permissions in terms of the actual module graph rather than in terms of which selector happened to supply the target's policy.

Alternatives considered:

- Continue matching allowlists against the winning selector string: rejected because exact overrides would silently change which allowlist entries are required.

### 6. Shared matching semantics move into `architecture-config`

Spec-level rules for canonical module resolution, key ownership semantics, invalid key shapes, key precedence, and allowlist selector grammar should live in the new `architecture-config` capability. Rule specs such as `import-control` should reference those shared semantics and only define the rule-specific behavior that sits on top of them.

This reduces duplication and prevents future drift between architecture consumers.

## Risks / Trade-offs

- [Breaking existing configs that use file-shaped keys] -> Document the change clearly in the proposal/specs, update dogfooded configs, and add targeted invalid-configuration tests.
- [Canonical module resolution may surprise users in partially configured trees] -> Keep the anonymous-module fallback explicit in the spec and document that uncovered directories remain deny-by-default.
- [Different semantics for keys and imports could be confusing at first] -> Document the split explicitly with side-by-side examples and keep each side internally simple.
- [Selector precedence could still feel subtle in overlapping configs] -> Include precedence tables and examples in specs and tests, especially for exact-child vs wildcard-child overlaps.
- [Shared matching changes can ripple into multiple rules] -> Keep the matcher in `src/utils/architecture-policy.ts` as the single implementation point and update consumers through that shared API.

## Migration Plan

1. Add the new `architecture-config` spec defining canonical module paths, key ownership semantics, allowlist selector grammar, precedence, anonymous-module behavior, and invalid file-shaped keys.
2. Update the affected specs to reference `architecture-config` for shared matching semantics where applicable:
   - `import-control`
   - `no-whitebox-testing`
   - `no-false-sharing`
   - `plugin-configs`
3. Rework shared architecture matching utilities to resolve canonical module paths and apply the new selector precedence.
4. Update rule tests and dogfooded config examples to use directory-shaped selectors and `+` where repetition can be removed.
5. Update user-facing documentation for architecture configuration, including selector syntax, precedence, breaking removal of file-shaped keys, and migration examples.
6. Add upgrade notes for users who currently rely on file-shaped keys.

Rollback is straightforward during development: revert the matcher/spec changes as a unit. After release, the breaking config change should be handled through release notes rather than compatibility shims.

## Open Questions

- No major open design questions remain for this change. The remaining work is to capture the shared semantics precisely in specs and then implement them in the shared matcher.
