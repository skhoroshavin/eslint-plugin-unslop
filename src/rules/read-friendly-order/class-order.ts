/* eslint-disable no-restricted-syntax, complexity, unslop/read-friendly-order */
import type { Rule } from 'eslint'
import type { Node } from 'estree'
import { walkThisDeps } from './ast-utils.js'

interface MemberEntry {
  node: Node & Rule.NodeParentExtension
  idx: number
  name: string | null
  thisDeps: Set<string>
  kind: 'constructor' | 'field' | 'method'
  isPublic: boolean
  computed: boolean
}

export function checkClass(
  ctx: Rule.RuleContext,
  classBody: Node & Rule.NodeParentExtension,
): void {
  const analyzer = new ClassOrderAnalyzer(ctx, classBody)
  analyzer.analyze()
}

class ClassOrderAnalyzer {
  private readonly members: MemberEntry[]
  private readonly hasComputedMembers: boolean

  constructor(
    private readonly context: Rule.RuleContext,
    private readonly classBody: Node & Rule.NodeParentExtension,
  ) {
    const body = Reflect.get(classBody, 'body') as
      | Array<Node & Rule.NodeParentExtension>
      | undefined
    if (!body || body.length === 0) {
      this.members = []
      this.hasComputedMembers = false
      return
    }
    this.members = collectMembers(body)
    this.hasComputedMembers = this.members.some((member) => member.computed)
  }

  analyze(): void {
    if (this.members.length === 0) return
    if (this.checkCtorFirst()) return
    if (this.checkFieldOrder()) return
    this.checkMethodOrder()
  }

  private checkCtorFirst(): boolean {
    const ctorIdx = this.members.findIndex((member) => member.kind === 'constructor')
    if (ctorIdx <= 0) return false
    this.report('constructorFirst', this.members[ctorIdx])
    return true
  }

  private checkFieldOrder(): boolean {
    const ctorIdx = this.members.findIndex((member) => member.kind === 'constructor')
    if (ctorIdx < 0) return false
    for (const field of this.members.filter((member) => member.isPublic)) {
      if (field.idx <= ctorIdx) continue
      if (this.members.slice(ctorIdx + 1, field.idx).some((member) => member.kind === 'method')) {
        this.report('publicFieldOrder', field)
        return true
      }
    }
    return false
  }

  private checkMethodOrder(): void {
    const methods = this.members.filter((member) => member.kind === 'method')
    const cyclic = findCyclicMethods(methods)
    for (const method of methods) {
      if (!method.name || cyclic.has(method.name)) continue
      if (
        methods.some(
          (other) => other !== method && other.thisDeps.has(method.name!) && other.idx > method.idx,
        )
      ) {
        this.report('moveMemberBelow', method)
        return
      }
    }
  }

  private report(messageId: string, target: MemberEntry): void {
    const data = target.name && messageId === 'moveMemberBelow' ? { name: target.name } : {}
    this.context.report({
      node: target.node,
      messageId,
      data,
      fix: this.hasComputedMembers
        ? null
        : buildClassFix(this.context, this.members, this.classBody),
    })
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

function buildClassFix(
  ctx: Rule.RuleContext,
  members: MemberEntry[],
  classBody: Node & Rule.NodeParentExtension,
): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const src = ctx.sourceCode
    const sorted = sortMembers(members)
    const texts = sorted.map((m) => src.getText(m.node))
    const body = Reflect.get(classBody, 'body') as Array<Node & Rule.NodeParentExtension>
    const first = body[0]
    const last = body[body.length - 1]
    return fixer.replaceTextRange([first.range![0], last.range![1]], texts.join('\n\n'))
  }
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
  const placed = new Set<string>()
  while (queue.length > 0) {
    queue.sort((a, b) => a.idx - b.idx)
    const m = queue.shift()!
    result.push(m)
    if (m.name) placed.add(m.name)
    for (const d of m.thisDeps) {
      if (!placed.has(d) && inDeg.has(d)) {
        inDeg.set(d, inDeg.get(d)! - 1)
        if (inDeg.get(d) === 0) {
          const dm = byName.get(d)
          if (dm) queue.push(dm)
        }
      }
    }
  }
  for (const m of methods) {
    if (m.name && !placed.has(m.name)) result.push(m)
  }
  return result
}

function collectMembers(body: Array<Node & Rule.NodeParentExtension>): MemberEntry[] {
  return body.map((node, idx) => {
    const kind = getMemberKind(node)
    const name = getMemberName(node)
    const thisDeps = new Set<string>()
    walkThisDeps(node, thisDeps)
    const accessibility = Reflect.get(node, 'accessibility') as string | undefined
    const isPublic =
      node.type === 'PropertyDefinition' &&
      (accessibility === 'public' || accessibility === undefined)
    const computed = Reflect.get(node, 'computed') === true
    return { node, idx, name, thisDeps, kind, isPublic, computed }
  })
}

function getMemberKind(node: Node): 'constructor' | 'field' | 'method' {
  if (node.type === 'MethodDefinition') {
    return Reflect.get(node, 'kind') === 'constructor' ? 'constructor' : 'method'
  }
  return node.type === 'PropertyDefinition' ? 'field' : 'method'
}

function getMemberName(node: Node): string | null {
  const key = Reflect.get(node, 'key') as Record<string, unknown> | undefined
  if (key?.type === 'Identifier' && typeof key.name === 'string') return key.name
  return null
}
