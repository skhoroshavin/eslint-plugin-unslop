export function findCyclicNodes<T extends GraphNode>(nodes: T[]): Set<string> {
  const byName = new Map<string, T>()
  for (const node of nodes) {
    if (node.name !== null) byName.set(node.name, node)
  }
  const cyclic = new Set<string>()
  for (const name of byName.keys()) {
    if (reachesSelf(name, name, byName, new Set())) {
      cyclic.add(name)
    }
  }
  return cyclic
}

export function kahnSort<T extends GraphNode>(nodes: T[], compare: (a: T, b: T) => number): T[] {
  const sorter = new KahnSorter(nodes, compare)
  return sorter.sort()
}

function reachesSelf<T extends GraphNode>(
  target: string,
  current: string,
  byName: Map<string, T>,
  visited: Set<string>,
): boolean {
  const node = byName.get(current)
  if (node === undefined) return false
  for (const dep of node.deps) {
    if (!byName.has(dep)) continue
    if (dep === target) return true
    if (visited.has(dep)) continue
    visited.add(dep)
    if (reachesSelf(target, dep, byName, visited)) return true
  }
  return false
}

class KahnSorter<T extends GraphNode> {
  constructor(
    private readonly nodes: T[],
    private readonly compare: (a: T, b: T) => number,
  ) {
    for (const node of this.nodes) {
      if (node.name !== null) this.byName.set(node.name, node)
    }
    for (const name of this.byName.keys()) this.inDeg.set(name, 0)
    for (const node of this.nodes) {
      for (const dep of node.deps) {
        this.incrementInDegree(dep)
      }
    }
    this.queue = this.nodes.filter((node) => node.name === null || this.inDeg.get(node.name) === 0)
  }

  private readonly byName = new Map<string, T>()
  private readonly inDeg = new Map<string, number>()
  private readonly queue: T[]
  private readonly result: T[] = []
  private readonly placed = new Set<string>()

  sort(): T[] {
    this.processQueue()
    for (const node of this.nodes) {
      if (node.name !== null && !this.placed.has(node.name)) this.result.push(node)
    }
    return this.result
  }

  private incrementInDegree(name: string): void {
    const degree = this.inDeg.get(name)
    if (degree === undefined) return
    this.inDeg.set(name, degree + 1)
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      this.queue.sort(this.compare)
      const node = this.queue.shift()
      if (node === undefined) return
      this.result.push(node)
      if (node.name !== null) this.placed.add(node.name)
      this.relaxDeps(node)
    }
  }

  private relaxDeps(node: T): void {
    for (const dep of node.deps) {
      if (this.placed.has(dep) || !this.inDeg.has(dep)) continue
      this.decrementInDegree(dep)
      if (this.inDeg.get(dep) !== 0) continue
      const depNode = this.byName.get(dep)
      if (depNode !== undefined && !this.placed.has(dep)) this.queue.push(depNode)
    }
  }

  private decrementInDegree(name: string): void {
    const degree = this.inDeg.get(name)
    if (degree === undefined) return
    this.inDeg.set(name, degree - 1)
  }
}

interface GraphNode {
  name: string | null
  deps: Set<string>
}
