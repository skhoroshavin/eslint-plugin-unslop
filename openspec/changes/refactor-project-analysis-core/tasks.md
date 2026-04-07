## 1. Shared Project Context

- [ ] 1.1 Add `ts-morph` and any needed tsconfig discovery helper dependency, and wire them into the repository without changing rule behavior.
- [ ] 1.2 Introduce a `ProjectContext` utility that centralizes project-backed local resolution, source file lookup, source file listing, and import declaration access.
- [ ] 1.3 Shrink `ArchitecturePolicyResolver` so it retains policy parsing, matcher selection, `sourceRoot`, and entrypoint classification while delegating local resolution to `ProjectContext`.

## 2. Rule Migration

- [ ] 2.1 Update alias-based architecture rule tests so project-backed scenarios declare the `tsconfig` path settings they depend on.
- [ ] 2.2 Refactor `unslop/no-false-sharing` to use `ProjectContext` for project file access and import declarations, replacing regex parsing and bespoke source-tree scanning while preserving current diagnostics and consumer counting.
- [ ] 2.3 Refactor `unslop/import-control` to use `ProjectContext` for local specifier resolution while preserving matcher behavior, shallow-entrypoint allowance, namespace checks, and same-module depth checks.

## 3. Cleanup And Verification

- [ ] 3.1 Remove superseded bespoke resolution and scanning code once both rules are migrated and covered.
- [ ] 3.2 Run `npm run fix`, then `npm run verify`, then `npm run test`, and address any issues introduced by the refactor.
