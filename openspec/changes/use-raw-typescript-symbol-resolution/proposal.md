## Why

The architecture rules currently mix ESTree inspection, manual path probing, and raw source-text scanning to approximate TypeScript module and symbol behavior. That creates avoidable false positives, misses re-export and alias cases, and keeps resolution logic in plugin code that TypeScript already knows how to do better.

## What Changes

- Replace custom local-module resolution in architecture rules with TypeScript-native project and module resolution.
- Upgrade `unslop/no-false-sharing` from name-and-file matching to canonical TypeScript symbol analysis so re-exports, aliases, and backing declarations are resolved through the compiler.
- Make architecture rules fail open when a TypeScript semantic project cannot be created for the current file, instead of trying to approximate semantic analysis from partial inputs.
- Narrow the change to architecture rules and their supporting utilities; other rule families keep their current behavior.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `architecture-import-export-control`: Change architecture-rule resolution requirements to use TypeScript project/module resolution as the source of truth for local imports, entrypoint checks, and boundary analysis.
- `no-false-sharing-symbol-analysis`: Change shared-symbol consumer discovery to use canonical TypeScript symbol resolution instead of raw source scanning and string-matched import names.
- `tsconfig-resolution`: Change project discovery requirements from `get-tsconfig`-driven config parsing toward TypeScript-backed project creation, including fail-open behavior when semantic project setup is unavailable.

## Impact

- Affected code: `src/rules/import-control/index.ts`, `src/rules/no-false-sharing/index.ts`, and shared resolution utilities under `src/utils/`.
- Affected dependencies/systems: architecture rules will rely on the TypeScript compiler API as the primary resolution engine for project, module, and symbol analysis.
- Testing impact: architecture rule scenarios will need coverage for alias resolution, re-export chains, canonical symbol matching, and semantic-project failure/no-op behavior.

## Non-goals

- Rewriting non-architecture rules to depend on TypeScript semantic analysis.
- Expanding `export-control` beyond its current syntax-driven contract enforcement unless the new specs require it.
- Introducing source mutation, codemods, or editor-oriented abstractions such as `ts-morph` as part of this change.
