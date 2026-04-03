import type { Rule } from 'eslint'
import type { Node } from 'estree'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow special Unicode characters that have ASCII equivalents',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      bannedCharacter:
        'Unexpected special Unicode character U+{{code}}. Use the ASCII equivalent instead.',
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (node.type !== 'Literal') return
        if (typeof node.value !== 'string') return
        const raw = context.sourceCode.getText(node)
        const wrapper = getWrapper(raw)
        const inner = raw.slice(1, -1)
        const matches = findBanned(inner)
        if (matches.length === 0) return

        const fixed = applyFixes(raw, matches, wrapper, 1)
        reportMatches({ context, node, matches, fixed })
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          const raw = context.sourceCode.getText(quasi)
          const matches = findBanned(raw)
          if (matches.length === 0) continue

          const fixed = applyFixes(raw, matches, '`', 0)
          reportMatches({ context, node: quasi, matches, fixed })
        }
      },
    }
  },
}

interface ReportInput {
  context: Rule.RuleContext
  node: Node
  matches: BannedMatch[]
  fixed: string | null
}

function reportMatches(input: ReportInput): void {
  const { context, node, matches, fixed } = input
  const range = node.range
  for (let i = 0; i < matches.length; i++) {
    context.report({
      node,
      messageId: 'bannedCharacter',
      data: { code: formatCode(matches[i].char) },
      fix: i === 0 && fixed && range ? (fixer) => fixer.replaceTextRange(range, fixed) : null,
    })
  }
}

function getWrapper(raw: string): QuoteChar {
  const first = raw[0]
  if (first === '"' || first === "'" || first === '`') return first
  return '"'
}

function findBanned(text: string): BannedMatch[] {
  const results: BannedMatch[] = []
  BANNED_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BANNED_PATTERN.exec(text)) !== null) {
    results.push({
      char: m[0],
      index: m.index,
      entry: BANNED_CHARS[m[0]],
    })
  }
  return results
}

const BANNED_CHARS: Record<string, CharEntry> = {
  '\u201C': { replacement: '"', isQuote: '"' },
  '\u201D': { replacement: '"', isQuote: '"' },
  '\u2018': { replacement: "'", isQuote: "'" },
  '\u2019': { replacement: "'", isQuote: "'" },
  '\u00A0': { replacement: ' ', isQuote: null },
  '\u202F': { replacement: ' ', isQuote: null },
  '\u2007': { replacement: ' ', isQuote: null },
  '\u2008': { replacement: ' ', isQuote: null },
  '\u2009': { replacement: ' ', isQuote: null },
  '\u200A': { replacement: ' ', isQuote: null },
  '\u2002': { replacement: ' ', isQuote: null },
  '\u2003': { replacement: ' ', isQuote: null },
  '\u205F': { replacement: ' ', isQuote: null },
  '\u3000': { replacement: ' ', isQuote: null },
  '\u200B': { replacement: '', isQuote: null },
  '\uFEFF': { replacement: '', isQuote: null },
  '\u2013': { replacement: '-', isQuote: null },
  '\u2014': { replacement: '-', isQuote: null },
  '\u2026': { replacement: '...', isQuote: null },
}

const BANNED_PATTERN = new RegExp(`[${Object.keys(BANNED_CHARS).join('')}]`, 'g')

function applyFixes(
  raw: string,
  matches: BannedMatch[],
  wrapper: QuoteChar,
  offset: number,
): string | null {
  let result = raw
  let anyFixed = false
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    if (!isSafe(match.entry, wrapper)) continue
    anyFixed = true
    const pos = match.index + offset
    result = result.slice(0, pos) + match.entry.replacement + result.slice(pos + match.char.length)
  }
  return anyFixed ? result : null
}

function isSafe(entry: CharEntry, wrapper: QuoteChar): boolean {
  if (!entry.isQuote) return true
  if (wrapper === '`') return true
  return entry.isQuote !== wrapper
}

interface BannedMatch {
  char: string
  index: number
  entry: CharEntry
}

interface CharEntry {
  replacement: string
  isQuote: QuoteChar | null
}

type QuoteChar = '"' | "'" | '`'

function formatCode(char: string): string {
  return char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
}

export default rule
