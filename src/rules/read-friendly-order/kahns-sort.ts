export function kahnsTopologicalSort<T extends KahnsItem>(
  items: T[],
  priority?: (item: T) => number,
): T[] {
  const byName = new Map<string, T>()
  for (const e of items) {
    if (e.name) byName.set(e.name, e)
  }
  const { inDeg, eagerDependents } = buildInDegrees(items, byName)
  const queue = items.filter((e) => !e.name || inDeg.get(e.name) === 0)
  const result: T[] = []
  const state: KahnsState<T> = { placed: new Set<string>(), inDeg, byName, eagerDependents }
  drainQueue(queue, result, state, priority)
  appendRemaining(items, result, state.placed)
  return result
}

export function findCyclicNames<T extends KahnsItem>(items: T[]): Set<string> {
  const byName = new Map<string, T>()
  for (const e of items) {
    if (e.name) byName.set(e.name, e)
  }
  const inCycle = new Set<string>()
  for (const [name] of byName) {
    if (reachesSelf(name, name, byName, new Set())) {
      inCycle.add(name)
    }
  }
  return inCycle
}

function buildInDegrees<T extends KahnsItem>(
  items: T[],
  byName: Map<string, T>,
): { inDeg: Map<string, number>; eagerDependents: Map<string, string[]> } {
  const inDeg = new Map<string, number>()
  const eagerDependents = new Map<string, string[]>()
  for (const [name] of byName) {
    inDeg.set(name, 0)
    eagerDependents.set(name, [])
  }
  for (const item of items) {
    processItemDeps(item, inDeg, eagerDependents)
  }
  return { inDeg, eagerDependents }
}

function processItemDeps(
  item: KahnsItem,
  inDeg: Map<string, number>,
  eagerDependents: Map<string, string[]>,
): void {
  for (const d of item.deps) {
    if (!inDeg.has(d)) continue
    if (item.eager && item.name && inDeg.has(item.name)) {
      addEagerDependent(item.name, d, inDeg, eagerDependents)
    } else {
      inDeg.set(d, (inDeg.get(d) ?? 0) + 1)
    }
  }
}

function addEagerDependent(
  consumerName: string,
  dep: string,
  inDeg: Map<string, number>,
  eagerDependents: Map<string, string[]>,
): void {
  inDeg.set(consumerName, (inDeg.get(consumerName) ?? 0) + 1)
  const list = eagerDependents.get(dep) ?? []
  list.push(consumerName)
  eagerDependents.set(dep, list)
}

function drainQueue<T extends KahnsItem>(
  queue: T[],
  result: T[],
  state: KahnsState<T>,
  priority?: (item: T) => number,
): void {
  while (queue.length > 0) {
    queue.sort((a, b) => (priority ? priority(a) - priority(b) : 0) || a.idx - b.idx)
    const item = queue.shift()
    if (item === undefined) break
    result.push(item)
    if (item.name) state.placed.add(item.name)
    decrementDeps(item, queue, state)
  }
}

function decrementDeps<T extends KahnsItem>(item: T, queue: T[], state: KahnsState<T>): void {
  decrementNonEager(item, queue, state)
  decrementEager(item, queue, state)
}

function decrementNonEager<T extends KahnsItem>(item: T, queue: T[], state: KahnsState<T>): void {
  for (const d of item.deps) {
    if (state.placed.has(d) || !state.inDeg.has(d)) continue
    const current = state.inDeg.get(d) ?? 0
    state.inDeg.set(d, current - 1)
    if (current - 1 === 0) enqueueByName(d, queue, state)
  }
}

function decrementEager<T extends KahnsItem>(item: T, queue: T[], state: KahnsState<T>): void {
  if (!item.name) return
  for (const consumerName of state.eagerDependents.get(item.name) ?? []) {
    if (state.placed.has(consumerName) || !state.inDeg.has(consumerName)) continue
    const current = state.inDeg.get(consumerName) ?? 0
    state.inDeg.set(consumerName, current - 1)
    if (current - 1 === 0) enqueueByName(consumerName, queue, state)
  }
}

function enqueueByName<T extends KahnsItem>(name: string, queue: T[], state: KahnsState<T>): void {
  const entry = state.byName.get(name)
  if (entry && !state.placed.has(name)) queue.push(entry)
}

interface KahnsState<T> {
  placed: Set<string>
  inDeg: Map<string, number>
  byName: Map<string, T>
  eagerDependents: Map<string, string[]>
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

interface KahnsItem {
  name: string | null
  deps: Set<string>
  idx: number
  /** True when the declaration's initializer is evaluated eagerly at module-init time
   *  (e.g. const x = expr(), export default expr()). Eager consumers must have their
   *  dependencies placed *before* them in the sort to avoid TDZ ReferenceErrors.
   *  Non-eager items (functions, types) follow the standard read-friendly order
   *  where consumers are placed before helpers. */
  eager?: boolean
}
