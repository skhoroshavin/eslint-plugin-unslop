## Why

`unslop/no-false-sharing` currently counts only direct imports of a shared entrypoint file as symbol consumers. That misses legitimate reuse inside the same shared module, so barrel exports can be reported as falsely shared even when other shared-module files depend on the underlying symbol.

## What Changes

- Modify `no-false-sharing` requirements so shared symbols can count consumers from both the public entrypoint and same-module internal usage of the exported symbol.
- Define that multiple internal consuming files within the same shared module collapse to one internal consumer group.
- Define that an internal consumer group alone is still insufficient: a symbol used only inside its own shared module must still be reported as not truly shared.
- Add scenarios covering direct entrypoint exports, re-exported symbols backed by internal files, and mixed internal plus external consumption.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `architecture-import-export-control`: Clarify how `no-false-sharing` counts consumer groups for symbols exported from shared module entrypoints when the symbol is also used from within the same shared module.
- `no-false-sharing-symbol-analysis`: Expand symbol-consumer analysis to count same-shared-module internal usage as one collapsed consumer group while still requiring at least two total groups before a symbol is considered truly shared.

## Impact

- **Affected rule**: `src/rules/no-false-sharing/index.ts` consumer discovery and grouping behavior.
- **Affected tests**: `src/rules/no-false-sharing/index.test.ts` will need coverage for internal shared consumers, internal-only consumers, and mixed internal-plus-external consumers.
- **Spec impact**: Existing `architecture-import-export-control` and `no-false-sharing-symbol-analysis` requirements need updates; no new capability is needed.

## Non-goals

- Changing `import-control` public-entrypoint rules or allowing cross-module imports of internal files.
- Replacing the rule with full TypeScript symbol graph analysis or parser-service-based reference tracking.
- Broadening false-sharing beyond the current shared-entrypoint scope.
