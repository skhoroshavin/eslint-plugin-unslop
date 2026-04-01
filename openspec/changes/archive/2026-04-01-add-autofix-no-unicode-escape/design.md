## Context

The `no-unicode-escape` rule (src/rules/no-unicode-escape.ts) detects `\uXXXX` escape sequences in string literals. It uses a shared utility `createStringLiteralListener` from `src/utils/string-literal-listener.ts` to handle both regular string literals (`Literal` nodes) and template literals (`TemplateLiteral` nodes).

Currently, the rule only reports violations without autofix:

```typescript
context.report({ node, messageId: 'preferLiteral' })
```

The rule processes strings in two modes:

1. **Literal nodes**: Gets raw value including escapes
2. **TemplateLiteral quasis**: Gets raw or cooked value based on `includeEscapedUnicode` flag

## Goals / Non-Goals

**Goals:**

- Add autofix that converts `\uXXXX` escapes to literal Unicode characters
- Handle both regular strings and template literal quasis
- Preserve quote style and avoid breaking code structure
- Skip autofix for "dangerous" characters that would require re-escaping

**Non-Goals:**

- Handle ES6 `\u{XXXXXX}` extended unicode escapes
- Fix template literal expressions (only the quasis/string parts)
- Support configurable "safe character" lists
- Modify the rule's detection logic or message system

## Decisions

### Decision 1: Which characters to skip

**Options considered:**

1. Skip nothing - try to fix all escapes (including quotes, backslashes)
2. Skip only quote delimiters and backslashes
3. Skip all characters that need escaping in strings

**Chosen: Option 3** - Skip characters that would require escaping in the replacement:

- `"` (0x0022) - string delimiter
- `'` (0x0027) - string delimiter
- `` ` `` (0x0060) - template literal delimiter
- `\` (0x005C) - escape character
- Control characters (0x0000-0x001F) - would need `\n`, `\t`, etc.
- Other characters needing escapes: `\b`, `\f`, `\r`, `\n`, `\t`, `\v`

**Rationale:** While ESLint fixer could re-escape these, it adds complexity and risk. Users can manually fix edge cases.

### Decision 2: String replacement strategy

**For Literal nodes:**

- Replace the entire node value
- Preserve original quote style by examining `node.raw` or context
- Re-wrap with same quote type

**For TemplateLiteral quasis:**

- Only fix the quasis (static parts), not expressions
- Use `fixer.replaceText()` on the specific quasi node
- Template literals already handle their own escaping, so we're just replacing the text content

### Decision 3: Quote preservation

The fixer needs to detect quote style to re-wrap properly:

```typescript
// Detect from node.raw which includes quotes
const quote = node.raw?.[0] // " or ' or ` (or undefined for templates)
```

For template literals, we don't wrap - just replace the quasi content.

## Risks / Trade-offs

**[Risk] Quote detection edge cases** → **Mitigation:** Test with `"`, `'`, `` ` ``, and escaped quotes inside strings

**[Risk] Template literal expression handling** → **Mitigation:** Only modify quasis, never expressions. The `createStringLiteralListener` gives us the raw text, we fix the escape, and replace the specific quasi node.

**[Risk] Multi-byte characters** → **Mitigation:** `String.fromCharCode()` handles up to 0xFFFF. Since `\uXXXX` is exactly 4 hex digits, this is sufficient.

**[Risk] Fix conflicts** → **Mitigation:** ESLint handles conflicting fixes automatically. Each violation is independent - different escape sequences are separate reports.

## Implementation Sketch

```typescript
// In context.report()
fix(fixer) {
  const replacement = computeReplacement(text, node)
  if (!replacement) return null
  return fixer.replaceText(node, replacement)
}

function computeReplacement(text: string, node: Literal | TemplateLiteral): string | null {
  // Decode all \uXXXX sequences
  let result = text.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
    const code = parseInt(hex, 16)
    // Skip if code needs escaping
    if (isUnsafeChar(code)) return match
    return String.fromCharCode(code)
  })

  // If no changes, return null
  if (result === text) return null

  // Re-wrap based on node type
  if (node.type === 'Literal') {
    const quote = node.raw?.[0] ?? '"'
    return `${quote}${result}${quote}`
  }

  // For templates, no wrapping needed
  return result
}
```

## Testing Strategy

Add `output` to existing invalid test cases:

```typescript
invalid: [
  {
    code: 'const x = "\\u0041";',
    errors: [{ messageId: 'preferLiteral' }],
    output: 'const x = "A";',
  },
  {
    code: 'const x = `\\u0041\\u0042`;',
    errors: [{ messageId: 'preferLiteral' }],
    output: 'const x = `AB`;',
  },
]
```

**Test cases to add:**

- Basic ASCII: `\u0041` → `A`
- Multiple escapes: `\u0041\u0042` → `AB`
- Template literal: `` `\u0041` `` → `` `A` ``
- Skipped chars: `\u0022` stays `\u0022` (quote delimiter)
- Mixed: `\u0041\u0022\u0042` → `\u0041\u0022\u0042` (no fix possible due to quote)

## Open Questions

None - design is ready for implementation.
