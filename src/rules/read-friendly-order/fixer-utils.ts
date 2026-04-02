import type { Node } from 'estree'
import type { Rule } from 'eslint'

export function stableTopologicalOrder(
  count: number,
  edges: Array<[from: number, to: number]>,
): number[] | undefined {
  const adj: Set<number>[] = Array.from({ length: count }, () => new Set<number>())
  const inDeg = new Array<number>(count).fill(0)
  applyEdges(adj, inDeg, edges)

  const queue = buildInitialQueue(inDeg)
  const result = drainQueue(queue, adj, inDeg)
  return result.length === count ? result : undefined
}

function applyEdges(adj: Set<number>[], inDeg: number[], edges: Array<[number, number]>): void {
  for (const [from, to] of edges) {
    if (from === to || adj[from].has(to)) continue
    adj[from].add(to)
    inDeg[to] += 1
  }
}

function buildInitialQueue(inDeg: number[]): number[] {
  const queue: number[] = []
  for (let i = 0; i < inDeg.length; i += 1) {
    if (inDeg[i] === 0) queue.push(i)
  }
  return queue
}

function drainQueue(queue: number[], adj: Set<number>[], inDeg: number[]): number[] {
  const result: number[] = []
  while (queue.length > 0) {
    const cur = queue.shift()!
    result.push(cur)
    for (const next of adj[cur]) {
      inDeg[next] -= 1
      if (inDeg[next] === 0) insertSorted(queue, next)
    }
  }
  return result
}

function insertSorted(queue: number[], value: number): void {
  const pos = queue.findIndex((v) => value < v)
  if (pos < 0) queue.push(value)
  else queue.splice(pos, 0, value)
}

export function createReplaceTextRangeFix(
  fixRange: [number, number, string] | undefined,
): (fixer: Rule.RuleFixer) => Rule.Fix | null {
  return (fixer) => {
    if (!fixRange) return null
    return fixer.replaceTextRange([fixRange[0], fixRange[1]], fixRange[2])
  }
}

export function isSameIndexOrder<T extends { index: number }>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.index !== b[i]?.index) return false
  }
  return true
}

export function createSafeReorderFix(
  sourceCode: Rule.RuleContext['sourceCode'],
  originalNodes: Node[],
  orderedNodes: Node[],
  options?: { leadingIndent?: string },
): [number, number, string] | undefined {
  const ranges = collectSortedRanges(originalNodes)
  if (!ranges) return undefined
  if (hasAmbiguousComments(sourceCode, ranges, originalNodes)) return undefined

  const start = ranges[0][0]
  const end = ranges[ranges.length - 1][1]
  const text = orderedNodes
    .map((n) => {
      const t = sourceCode.getText(n)
      if (options?.leadingIndent && !/^\s/.test(t)) return options.leadingIndent + t
      return t
    })
    .join('\n\n')

  return [start, end, text]
}

function collectSortedRanges(nodes: Node[]): Array<[number, number]> | undefined {
  const ranges: Array<[number, number]> = []
  for (const node of nodes) {
    if (!node.range) return undefined
    ranges.push(node.range)
  }
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i - 1][1] > sorted[i][0]) return undefined
  }
  return sorted
}

function hasAmbiguousComments(
  sourceCode: Rule.RuleContext['sourceCode'],
  sortedRanges: Array<[number, number]>,
  nodes: Node[],
): boolean {
  const start = sortedRanges[0][0]
  const end = sortedRanges[sortedRanges.length - 1][1]

  for (const comment of sourceCode.getAllComments()) {
    const r = comment.range
    if (!r || r[0] < start || r[1] > end) continue
    if (!isInsideAnyNode(r, nodes)) return true
  }
  return false
}

function isInsideAnyNode(range: [number, number], nodes: Node[]): boolean {
  for (const node of nodes) {
    if (!node.range) continue
    if (range[0] >= node.range[0] && range[1] <= node.range[1]) return true
  }
  return false
}
