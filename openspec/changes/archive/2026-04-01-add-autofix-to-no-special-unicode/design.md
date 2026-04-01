## Context

The `no-special-unicode` rule currently detects 19 problematic unicode characters in strings but requires manual fixing. This change adds autofix support following the same pattern used by `no-unicode-escape` which already has successful autofix implementation. The rule uses `createStringLiteralListener` to scan string literals and template literals.

## Goals / Non-Goals

**Goals:**

- Add autofix capability to `no-special-unicode` rule
- Replace all 19 banned unicode characters with ASCII equivalents
- Follow existing ESLint autofix patterns in the codebase
- Maintain backward compatibility (detection behavior unchanged)

**Non-Goals:**

- Adding new banned characters
- Changing error messages
- Modifying detection logic
- Adding configuration options for replacements

## Decisions

### Decision 1: Use simple character replacement strategy

**Rationale**: All banned characters have clear 1:1 mappings to ASCII equivalents. Simple replacement is safest and follows the existing `no-unicode-escape` pattern.

### Decision 2: Replace special spaces with regular space, not removal

**Rationale**: While some zero-width spaces could be removed, replacing with regular space (` `) is more predictable and preserves intent (whitespace was likely intentional).

Exception: Zero-width no-break space (BOM - `\uFEFF`) should be removed entirely as it's typically unintentional.

### Decision 3: Handle all replacements in single fix pass

**Rationale**: When a string contains multiple banned characters, ESLint's fix API allows returning one fix that handles all of them. This is more efficient than multiple passes.

### Decision 4: Use string mapping approach over regex replacement

**Rationale**: While regex could work, a simple character-by-character mapping is more explicit, easier to read, and safer for edge cases.

## Risks / Trade-offs

**[Risk]** Replacing quotes in template literals might affect escaping → **Mitigation**: ESLint's fixer handles this automatically via `replaceText()`, no additional escaping needed

**[Risk]** Zero-width characters removal might change string behavior in subtle ways (e.g., regex boundaries) → **Mitigation**: These characters are invisible and typically unintentional; the fix improves code clarity

**[Risk]** Multiple fixes in same file might conflict → **Mitigation**: ESLint's fix conflict resolution handles this; our fixes are independent per node

## Migration Plan

Not applicable - this is an additive feature that doesn't require migration. Existing code continues to work unchanged.

## Open Questions

None - implementation approach is clear from existing patterns.
