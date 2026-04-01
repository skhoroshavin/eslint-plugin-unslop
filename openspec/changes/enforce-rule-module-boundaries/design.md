## Context

The repository currently mixes flat rule files with ad hoc helper subpaths. `no-false-sharing` and `read-friendly-order` already have rule-specific helper modules, but the public/private boundary for each rule is not enforced. The change introduces a single-folder-per-rule layout, a single public rule entrypoint, black-box tests, and dependency-cruiser guardrails expressed as an allowlist so the architecture is easy to read and hard to bypass accidentally.

## Goals / Non-Goals

**Goals:**

- Give every rule one obvious public entrypoint at `src/rules/<rule>/index.ts`.
- Keep rule internals private to their own folder.
- Prevent rule-to-rule imports while still allowing shared utilities from `src/utils`.
- Keep rule tests black-box by routing them through the rule entrypoint rather than internal helpers.
- Keep the dependency-cruiser configuration short, allowlist-based, and understandable without deep tool expertise.

**Non-Goals:**

- Rewriting rule logic or changing any rule's external behavior.
- Introducing nested subfolders inside rule folders.
- Enforcing export-shape semantics beyond the convention that `index.ts` is the public entrypoint.
- Broadly modeling all repository dependency rules in dependency-cruiser.

## Decisions

### Decision: Use a flat per-rule folder layout

Each rule will live in `src/rules/<rule>/` with sibling files only. This keeps paths and dependency-cruiser patterns simple and avoids inventing a second layer of architecture inside rules.

Alternative considered: allow nested rule subfolders. Rejected because the current codebase does not need them and they make the guardrail patterns harder to read.

### Decision: Treat `index.ts` as the only public rule surface

`src/rules/index.ts` will import only `src/rules/<rule>/index.ts`, and rule tests will import only their rule's `index.ts` plus approved shared test helpers. Small rules can keep all logic directly in `index.ts`; larger rules can split internals into sibling files.

Alternative considered: separate `rule.ts` from `index.ts` for every rule. Rejected because it adds boilerplate for small rules without improving the public boundary.

### Decision: Enforce architecture with dependency-cruiser allowlists

Dependency-cruiser will describe allowed edges for three zones: the rule registry, rule implementation files, and rule tests. Any undeclared edge fails by default. This captures the intended architecture more directly than a blacklist of forbidden imports.

Alternative considered: use only conventions or ESLint restrictions. Rejected because the desired boundaries depend on folder relationships, and dependency-cruiser is a better fit for repository structure rules.

### Decision: Allow tests to use shared test utilities, but not rule internals

Rule tests remain black-box with respect to their own rule implementation, while still being able to use shared helpers such as `src/utils/test-fixtures.ts`. This preserves the public/private boundary without forcing duplicated test harness code into every rule folder.

Alternative considered: require tests to import only `src/rules/<rule>/index.ts` and nothing else. Rejected because it would make shared parser and fixture helpers awkward to reuse.

### Decision: Switch `unslop/no-false-sharing` to directory mode for repository linting

The repository's own structural linting should align with the new folder-based cohesion unit. Directory mode matches the new architectural intent better than file mode.

## Risks / Trade-offs

- [Rule migration churn] -> Migrate in a mechanical pattern and keep behavior unchanged so review can focus on structure.
- [Dependency-cruiser config becomes cryptic] -> Limit the config to a few zone-level allowlists and avoid over-modeling special cases.
- [Black-box tests become too restrictive] -> Explicitly allow shared test helpers while continuing to block imports of rule internals.
- [Public entrypoint convention drifts] -> Keep `src/rules/index.ts` and dependency-cruiser centered on `index.ts` so deviations are visible immediately.

## Migration Plan

1. Move each rule and its tests into `src/rules/<rule>/`.
2. Update `src/rules/index.ts` and any internal imports to the new entrypoints.
3. Add dependency-cruiser and encode the three allowlist zones.
4. Update repository lint configuration, including `unslop/no-false-sharing` directory mode.
5. Run targeted tests, then full verification.

Rollback is straightforward because the change is local to repository structure and tooling: remove dependency-cruiser, restore the old paths, and revert the lint configuration if needed.

## Open Questions

- Whether additional plugin-level integration tests should move to a top-level `tests/` directory later, while rule tests remain colocated.
- Whether the repository should eventually enforce the `index.ts` public-surface convention with an additional lint or check beyond import-boundary enforcement.
