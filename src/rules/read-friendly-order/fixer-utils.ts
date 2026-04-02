import type { Node } from 'estree'
import type { Rule } from 'eslint'

export function stableTopologicalOrder(
  count: number,
  edges: Array<[from: number, to: number]>,
): number[] | undefined {
  const adjacency = createAdjacency(count)
  const inDegree = new Array<number>(count).fill(0)
  applyEdges(adjacency, inDegree, edges)
  const queue = buildInitialQueue(inDegree)
  const ordered = consumeQueue(queue, adjacency, inDegree)
  return ordered.length === count ? ordered : undefined
}

function applyEdges(
  adjacency: Array<Set<number>>,
  inDegree: number[],
  edges: Array<[from: number, to: number]>,
): void {
  for (const [from, to] of edges) {
    if (isEdgeIgnored(adjacency, from, to)) continue
    adjacency[from].add(to)
    inDegree[to] += 1
  }
}

function isEdgeIgnored(adjacency: Array<Set<number>>, from: number, to: number): boolean {
  if (from === to) return true
  return adjacency[from].has(to)
}

export function createReplaceTextRangeFix(
  fixRange: [number, number, string] | undefined,
): (fixer: Rule.RuleFixer) => Rule.Fix | null {
  return (fixer: Rule.RuleFixer): Rule.Fix | null => {
    if (!fixRange) return null
    return fixer.replaceTextRange([fixRange[0], fixRange[1]], fixRange[2])
  }
}

export function isSameIndexOrder<T extends { index: number }>(
  original: T[],
  candidate: T[],
): boolean {
  if (original.length !== candidate.length) return false

  for (let i = 0; i < original.length; i += 1) {
    if (original[i]?.index !== candidate[i]?.index) return false
  }

  return true
}

function consumeQueue(
  queue: number[],
  adjacency: Array<Set<number>>,
  inDegree: number[],
): number[] {
  const ordered: number[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    ordered.push(current)
    visitNextNodes(adjacency[current] ?? [], inDegree, queue)
  }

  return ordered
}

function visitNextNodes(nextNodes: Iterable<number>, inDegree: number[], queue: number[]): void {
  for (const next of nextNodes) {
    inDegree[next] -= 1
    if (inDegree[next] === 0) insertSorted(queue, next)
  }
}

function createAdjacency(count: number): Array<Set<number>> {
  const adjacency: Array<Set<number>> = []
  for (let i = 0; i < count; i += 1) adjacency.push(new Set<number>())
  return adjacency
}

function buildInitialQueue(inDegree: number[]): number[] {
  const queue: number[] = []
  for (const [index, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(index)
  }
  return queue
}

function insertSorted(queue: number[], value: number): void {
  const index = queue.findIndex((entry) => value < entry)
  if (index < 0) {
    queue.push(value)
    return
  }
  queue.splice(index, 0, value)
}

export function createSafeReorderFix(
  sourceCode: Rule.RuleContext['sourceCode'],
  originalNodes: RangedNode[],
  orderedNodes: RangedNode[],
  options?: { leadingIndent?: string },
): [number, number, string] | undefined {
  const originalRanges = extractSortedRanges(originalNodes)
  if (!originalRanges) return undefined
  if (hasAmbiguousComments(sourceCode, originalRanges, originalNodes)) return undefined

  const [start] = originalRanges[0]
  const [, end] = originalRanges[originalRanges.length - 1]
  const text = orderedNodes
    .map((node) => formatNodeText(sourceCode.getText(node), options))
    .join('\n\n')

  return [start, end, text]
}

function formatNodeText(text: string, options?: { leadingIndent?: string }): string {
  if (!options?.leadingIndent) return text
  if (/^\s/.test(text)) return text
  return options.leadingIndent + text
}

function extractSortedRanges(nodes: RangedNode[]): Array<[number, number]> | undefined {
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
  nodes: RangedNode[],
): boolean {
  const [start] = sortedRanges[0]
  const [, end] = sortedRanges[sortedRanges.length - 1]

  for (const comment of sourceCode.getAllComments()) {
    const range = comment.range
    if (!range) continue
    if (range[0] < start || range[1] > end) continue
    if (!isInsideAnyNode(range, nodes)) return true
  }

  return false
}

function isInsideAnyNode(commentRange: [number, number], nodes: RangedNode[]): boolean {
  for (const node of nodes) {
    const range = node.range
    if (!range) continue
    if (commentRange[0] >= range[0] && commentRange[1] <= range[1]) return true
  }
  return false
}

type RangedNode = Node
