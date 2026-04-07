/* eslint-disable complexity */

interface GraphNode {
  name: string | null
  deps: Set<string>
}

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

export function kahnSort<T extends GraphNode>(nodes: T[], compare: (a: T, b: T) => number): T[] {
  const byName = new Map<string, T>()
  for (const node of nodes) {
    if (node.name !== null) byName.set(node.name, node)
  }
  const inDeg = new Map<string, number>()
  for (const name of byName.keys()) inDeg.set(name, 0)
  for (const node of nodes) {
    for (const dep of node.deps) {
      if (inDeg.has(dep)) inDeg.set(dep, inDeg.get(dep)! + 1)
    }
  }
  return drain(nodes, inDeg, byName, compare)
}

function drain<T extends GraphNode>(
  nodes: T[],
  inDeg: Map<string, number>,
  byName: Map<string, T>,
  compare: (a: T, b: T) => number,
): T[] {
  const queue = nodes.filter((n) => n.name === null || inDeg.get(n.name) === 0)
  const result: T[] = []
  const placed = new Set<string>()

  while (queue.length > 0) {
    queue.sort(compare)
    const node = queue.shift()!
    result.push(node)
    if (node.name !== null) placed.add(node.name)
    for (const dep of node.deps) {
      if (placed.has(dep) || !inDeg.has(dep)) continue
      inDeg.set(dep, inDeg.get(dep)! - 1)
      if (inDeg.get(dep) === 0) {
        const depNode = byName.get(dep)
        if (depNode !== undefined && !placed.has(dep)) queue.push(depNode)
      }
    }
  }
  for (const node of nodes) {
    if (node.name !== null && !placed.has(node.name)) result.push(node)
  }
  return result
}
