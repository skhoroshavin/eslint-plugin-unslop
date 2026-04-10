import type { Rule } from 'eslint'

import type { Node } from 'estree'

import { walkThisDeps } from './ast-utils.js'

export function checkClass(ctx: Rule.RuleContext, classBody: Node): void {
  const body = getClassBodyArray(classBody)
  if (!body || body.length === 0) return
  const members = collectMembers(body)
  const hasComputed = members.some((m) => m.computed)

  if (checkCtorFirst(ctx, members, classBody, hasComputed)) return
  if (checkFieldOrder(ctx, members, classBody, hasComputed)) return
  checkMethodOrder(ctx, members, classBody, hasComputed)
}

function checkCtorFirst(
  ctx: Rule.RuleContext,
  members: MemberEntry[],
  classBody: Node,
  hasComputed: boolean,
): boolean {
  const ctorIdx = members.findIndex((m) => m.kind === 'constructor')
  if (ctorIdx <= 0) return false
  report({
    ctx,
    members,
    classBody,
    hasComputed,
    messageId: 'constructorFirst',
    target: members[ctorIdx],
  })
  return true
}

function checkFieldOrder(
  ctx: Rule.RuleContext,
  members: MemberEntry[],
  classBody: Node,
  hasComputed: boolean,
): boolean {
  const ctorIdx = members.findIndex((m) => m.kind === 'constructor')
  if (ctorIdx < 0) return false
  for (const f of members.filter((m) => m.isPublic)) {
    if (f.idx <= ctorIdx) continue
    if (members.slice(ctorIdx + 1, f.idx).some((m) => m.kind === 'method')) {
      report({ ctx, members, classBody, hasComputed, messageId: 'publicFieldOrder', target: f })
      return true
    }
  }
  return false
}

function checkMethodOrder(
  ctx: Rule.RuleContext,
  members: MemberEntry[],
  classBody: Node,
  hasComputed: boolean,
): void {
  const methods = members.filter((m) => m.kind === 'method')
  const cyclic = findCyclicMethods(methods)
  for (const m of methods) {
    if (!m.name || cyclic.has(m.name)) continue
    if (methods.some((o) => o !== m && o.thisDeps.has(m.name!) && o.idx > m.idx)) {
      report({ ctx, members, classBody, hasComputed, messageId: 'moveMemberBelow', target: m })
      return
    }
  }
}

function findCyclicMethods(methods: MemberEntry[]): Set<string> {
  const byName = new Map(methods.filter((m) => m.name).map((m) => [m.name!, m]))
  const inCycle = new Set<string>()
  for (const [name] of byName) {
    if (methodReachesSelf(name, name, byName, new Set())) {
      inCycle.add(name)
    }
  }
  return inCycle
}

function methodReachesSelf(
  target: string,
  current: string,
  byName: Map<string, MemberEntry>,
  visited: Set<string>,
): boolean {
  const entry = byName.get(current)
  if (!entry) return false
  for (const dep of entry.thisDeps) {
    if (!byName.has(dep)) continue
    if (dep === target) return true
    if (visited.has(dep)) continue
    visited.add(dep)
    if (methodReachesSelf(target, dep, byName, visited)) return true
  }
  return false
}

function report(input: ReportArgs): void {
  const { ctx, members, classBody, hasComputed, messageId, target } = input
  const data = target.name && messageId === 'moveMemberBelow' ? { name: target.name } : {}
  ctx.report({
    node: target.node,
    messageId,
    data,
    fix: hasComputed ? null : buildClassFix(ctx, members, classBody),
  })
}

interface ReportArgs {
  ctx: Rule.RuleContext
  members: MemberEntry[]
  classBody: Node
  hasComputed: boolean
  messageId: string
  target: MemberEntry
}

function buildClassFix(
  ctx: Rule.RuleContext,
  members: MemberEntry[],
  classBody: Node,
): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const src = ctx.sourceCode
    const sorted = sortMembers(members)
    const texts = sorted.map((m) => src.getText(m.node))
    const body = getClassBodyArray(classBody)!
    const first = body[0]
    const last = body[body.length - 1]
    return fixer.replaceTextRange([first.range![0], last.range![1]], texts.join('\n\n'))
  }
}

function getClassBodyArray(classBody: Node): Node[] | undefined {
  const raw = Reflect.get(classBody, 'body')
  if (!Array.isArray(raw)) return undefined
  return raw
}

function sortMembers(members: MemberEntry[]): MemberEntry[] {
  const ctor = members.find((m) => m.kind === 'constructor')
  const fields = members.filter((m) => m.isPublic && m.kind !== 'constructor')
  const methods = kahnsMethodSort(members.filter((m) => m.kind === 'method'))
  const result: MemberEntry[] = []
  if (ctor) result.push(ctor)
  result.push(...fields)
  result.push(...methods)
  return result
}

function kahnsMethodSort(methods: MemberEntry[]): MemberEntry[] {
  const byName = new Map(methods.filter((m) => m.name).map((m) => [m.name!, m]))
  const inDeg = new Map<string, number>()
  for (const name of byName.keys()) inDeg.set(name, 0)
  for (const m of methods) {
    for (const d of m.thisDeps) {
      if (inDeg.has(d)) inDeg.set(d, inDeg.get(d)! + 1)
    }
  }
  return drainKahns(methods, inDeg, byName)
}

function drainKahns(
  methods: MemberEntry[],
  inDeg: Map<string, number>,
  byName: Map<string, MemberEntry>,
): MemberEntry[] {
  const queue = methods.filter((m) => !m.name || inDeg.get(m.name) === 0)
  const result: MemberEntry[] = []
  const state: KahnsState = { placed: new Set<string>(), inDeg, byName }
  drainQueue(queue, result, state)
  appendRemaining(methods, result, state.placed)
  return result
}

function drainQueue(queue: MemberEntry[], result: MemberEntry[], state: KahnsState): void {
  while (queue.length > 0) {
    queue.sort((a, b) => a.idx - b.idx)
    const m = queue.shift()!
    result.push(m)
    if (m.name) state.placed.add(m.name)
    decrementDeps(m, queue, state)
  }
}

function decrementDeps(m: MemberEntry, queue: MemberEntry[], state: KahnsState): void {
  for (const d of m.thisDeps) {
    if (state.placed.has(d) || !state.inDeg.has(d)) continue
    state.inDeg.set(d, state.inDeg.get(d)! - 1)
    if (state.inDeg.get(d) === 0) {
      const dm = state.byName.get(d)
      if (dm) queue.push(dm)
    }
  }
}

interface KahnsState {
  placed: Set<string>
  inDeg: Map<string, number>
  byName: Map<string, MemberEntry>
}

function appendRemaining(methods: MemberEntry[], result: MemberEntry[], placed: Set<string>): void {
  for (const m of methods) {
    if (m.name && !placed.has(m.name)) result.push(m)
  }
}

function collectMembers(body: Node[]): MemberEntry[] {
  return body.map((node, idx) => buildMemberEntry(node, idx))
}

function buildMemberEntry(node: Node, idx: number): MemberEntry {
  const kind = getMemberKind(node)
  const name = getMemberName(node)
  const thisDeps = new Set<string>()
  walkThisDeps(node, thisDeps)
  const accessibility = strReflect(node, 'accessibility')
  const isPublic =
    node.type === 'PropertyDefinition' &&
    (accessibility === 'public' || accessibility === undefined)
  const computed = Reflect.get(node, 'computed') === true
  return { node, idx, name, thisDeps, kind, isPublic, computed }
}

interface MemberEntry {
  node: Node
  idx: number
  name: string | null
  thisDeps: Set<string>
  kind: 'constructor' | 'field' | 'method'
  isPublic: boolean
  computed: boolean
}

function strReflect(obj: object, key: string): string | undefined {
  const v = Reflect.get(obj, key)
  return typeof v === 'string' ? v : undefined
}

function getMemberKind(node: Node): 'constructor' | 'field' | 'method' {
  if (node.type === 'MethodDefinition') {
    return Reflect.get(node, 'kind') === 'constructor' ? 'constructor' : 'method'
  }
  return node.type === 'PropertyDefinition' ? 'field' : 'method'
}

function getMemberName(node: Node): string | null {
  const key = Reflect.get(node, 'key')
  if (!key || typeof key !== 'object') return null
  if (Reflect.get(key, 'type') !== 'Identifier') return null
  const name = Reflect.get(key, 'name')
  return typeof name === 'string' ? name : null
}
