export function kahnsTopologicalSort<T extends KahnsItem>(
  items: T[],
  priority?: (item: T) => number,
): T[] {
  const byName = new Map(items.filter((e) => e.name).map((e) => [e.name!, e]))
  const inDeg = buildInDegrees(items, byName)
  const queue = items.filter((e) => !e.name || inDeg.get(e.name) === 0)
  const result: T[] = []
  const state: KahnsState<T> = { placed: new Set<string>(), inDeg, byName }
  drainQueue(queue, result, state, priority)
  appendRemaining(items, result, state.placed)
  return result
}

export function findCyclicNames<T extends KahnsItem>(items: T[]): Set<string> {
  const byName = new Map(items.filter((e) => e.name).map((e) => [e.name!, e]))
  const inCycle = new Set<string>()
  for (const [name] of byName) {
    if (reachesSelf(name, name, byName, new Set())) {
      inCycle.add(name)
    }
  }
  return inCycle
}

interface KahnsItem {
  name: string | null
  deps: Set<string>
  idx: number
}

function buildInDegrees<T extends KahnsItem>(
  items: T[],
  byName: Map<string, T>,
): Map<string, number> {
  const inDeg = new Map<string, number>()
  for (const [name] of byName) inDeg.set(name, 0)
  for (const item of items) {
    for (const d of item.deps) {
      if (inDeg.has(d)) inDeg.set(d, inDeg.get(d)! + 1)
    }
  }
  return inDeg
}

function drainQueue<T extends KahnsItem>(
  queue: T[],
  result: T[],
  state: KahnsState<T>,
  priority?: (item: T) => number,
): void {
  while (queue.length > 0) {
    queue.sort((a, b) => (priority ? priority(a) - priority(b) : 0) || a.idx - b.idx)
    const item = queue.shift()!
    result.push(item)
    if (item.name) state.placed.add(item.name)
    decrementDeps(item, queue, state)
  }
}

function decrementDeps<T extends KahnsItem>(item: T, queue: T[], state: KahnsState<T>): void {
  for (const d of item.deps) {
    if (state.placed.has(d) || !state.inDeg.has(d)) continue
    state.inDeg.set(d, state.inDeg.get(d)! - 1)
    if (state.inDeg.get(d) === 0) {
      const dm = state.byName.get(d)
      if (dm && !state.placed.has(d)) queue.push(dm)
    }
  }
}

interface KahnsState<T> {
  placed: Set<string>
  inDeg: Map<string, number>
  byName: Map<string, T>
}

function appendRemaining<T extends KahnsItem>(items: T[], result: T[], placed: Set<string>): void {
  for (const item of items) {
    if (item.name && !placed.has(item.name)) result.push(item)
  }
}

function reachesSelf<T extends KahnsItem>(
  target: string,
  current: string,
  byName: Map<string, T>,
  visited: Set<string>,
): boolean {
  const entry = byName.get(current)
  if (!entry) return false
  for (const dep of entry.deps) {
    if (!byName.has(dep)) continue
    if (dep === target) return true
    if (visited.has(dep)) continue
    visited.add(dep)
    if (reachesSelf(target, dep, byName, visited)) return true
  }
  return false
}
