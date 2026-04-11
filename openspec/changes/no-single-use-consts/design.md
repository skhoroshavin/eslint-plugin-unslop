## Context

`no-false-sharing` already builds and caches a TypeScript semantic project through `src/utils/tsconfig-resolution.ts`, but that entry point is framed around architecture-policy consumers. The proposed `no-single-use-constants` rule needs the same program, checker, project root, and source-root data without importing architecture-specific state, and it needs to count symbol usage across the entire project while preserving the plugin's current no-op behavior when semantic context is unavailable.

This change crosses multiple modules: shared TypeScript context utilities, architecture-policy integration, a new rule, and rule tests. The design needs to keep the reusable TS project contract narrow so the new rule can consume it directly without broadening the rest of the architecture API surface.

## Goals / Non-Goals

**Goals:**

- Extract a shared TypeScript project-context helper that any rule can call with a filename and receive `program`, `checker`, `projectRoot`, and `sourceRoot` when a semantic project is available.
- Keep existing caching, tsconfig discovery, and graceful fallback behavior so rules become no-ops instead of throwing when TypeScript context cannot be built.
- Implement `no-single-use-constants` with deterministic counting rules: module-scope `const` only, plain identifier declarators only, function/class-expression initializers excluded, and report threshold of `count <= 1`.
- Avoid paying for a full-project semantic walk for declarations that can be decided from local ESLint references alone.

**Non-Goals:**

- Introduce autofix or suggestions for inlining constants.
- Expand the rule to `let`, `var`, destructured bindings, or function/class declarations.
- Redesign architecture-policy matching or `no-false-sharing` consumer semantics beyond swapping it onto the shared TS project-context helper.

## Decisions

### 1. Extract a rule-agnostic TypeScript project helper

Create `src/utils/ts-program.ts` with `getTypeScriptProjectContext(filename)`. It will own tsconfig discovery, config parsing, `ts.Program` construction, checker creation, module-resolution cache creation, derived `sourceRoot`, and project-file membership tracking. `src/utils/index.ts` will re-export this helper, and `getArchitectureRuleState` will call it internally instead of directly depending on the older tsconfig-resolution entry point.

Why this approach:

- It keeps semantic-project construction in one cache-backed place.
- It lets non-architecture rules depend on TypeScript context without importing architecture-policy concerns.
- It preserves the current contract that missing or invalid tsconfig data yields `undefined` instead of diagnostics or thrown errors.

Alternatives considered:

- Keep the helper in `tsconfig-resolution.ts` and export more of its internals. Rejected because the current name and usage pattern are centered on import/path resolution rather than general semantic analysis.
- Add a `getArchitectureProjectContext` helper under architecture utilities. Rejected because the new rule is not architecture-specific and would inherit the wrong dependency boundary.

### 2. Use a two-path usage counting strategy

`no-single-use-constants` will analyze only module-scope `const` declarators at `Program:exit`.

For non-exported constants, the rule will use ESLint's own variable/reference graph in the current file and count read references only. This handles the common case cheaply and avoids scanning the TypeScript program when no cross-file usage is possible.

For exported constants, the rule will resolve the declaration symbol through the shared TypeScript checker and walk source files in the semantic project to count matching identifier uses. The walk will skip import specifiers, export specifiers, and `export default FOO` positions so only real consumption contributes to the total.

Why this approach:

- Local-only constants do not need cross-file symbol resolution.
- Exported constants can be used from other files, so TypeScript symbol identity is the reliable source of truth.
- Splitting the paths keeps the rule simpler and cheaper than semantically walking the whole project for every declaration.

Alternatives considered:

- Use TypeScript symbol walking for every constant. Rejected because it adds unnecessary whole-program work for non-exported declarations and increases implementation surface.
- Use ESLint references only. Rejected because it cannot see cross-file usage of exported constants.

### 3. Count identifier occurrences by canonical symbol identity and AST position filtering

For exported constants, the implementation will compare each identifier's resolved symbol to the target declaration symbol after alias resolution. A use counts only when the identifier refers to the target symbol and is not syntactically part of an import/export-only position. This includes counting expression uses inside exports such as `export const BAR = FOO`, while excluding bare re-export forms like `export { FOO }` and `export default FOO`.

Why this approach:

- Canonical symbol identity avoids false negatives from re-exports or aliasing.
- AST-position filtering matches the intended definition of "real use" from the proposal.
- The counting rule stays deterministic and explainable in tests.

Alternatives considered:

- Count every identifier bound to the symbol. Rejected because import/export syntax would inflate counts without representing actual usage.
- Try to infer usage only from TypeScript reference APIs without syntax checks. Rejected because the rule needs finer control over excluded positions than a raw symbol match provides.

### 4. Report on the declarator, not each reference

The rule will report once per flagged `VariableDeclarator` with `singleUse` and include the constant name and final count. This matches existing rule style in the repo, keeps diagnostics stable, and avoids duplicate reports when a declaration is exported and locally referenced.

Why this approach:

- The change being requested is about whether the declaration should exist, not about any individual use site.
- Tests can assert one message per bad declaration with `messageId` and count data.

Alternatives considered:

- Report on the identifier declaration name only. Rejected because the declarator is the more stable node for plain validation and future rule extensions.
- Report on every file that contributes to the low count. Rejected because that would turn one design issue into noisy multi-file diagnostics.

## Risks / Trade-offs

- Whole-program identifier walks for exported constants could be expensive in large projects. -> Mitigation: limit semantic walking to exported constants only and reuse the cached program/checker.
- Symbol matching may behave differently for unusual TS emit-only constructs or declaration files. -> Mitigation: restrict analysis to project source files and write end-to-end tests around exports, re-exports, and alias-based imports.
- Extracting the TS helper could accidentally change architecture-rule behavior. -> Mitigation: keep the returned context shape aligned with the current `ProjectContext` data and leave `resolveImportTarget` behavior unchanged.
- Excluding import/export-only positions requires careful syntax classification. -> Mitigation: centralize the predicate for "countable identifier" so the test matrix covers each excluded and included form.

## Migration Plan

1. Extract the shared TypeScript project-context helper and switch architecture-policy to consume it without changing current observable behavior.
2. Add the new rule implementation and register it in the plugin rule index/config wiring as appropriate.
3. Add RuleTester coverage for local-only, exported, aliased, excluded-initializer, excluded-declarator, and graceful-fallback scenarios.
4. Run targeted tests first, then full verification and full test suite before the change is applied.

Rollback strategy: revert the new rule wiring and point architecture-policy back to the previous helper entry point. Because this change does not introduce persisted state or data migrations, rollback is code-only.

## Open Questions

- None at this stage. The remaining work is to encode the counting and exclusion rules precisely in specs and tests.
