import type { Rule } from 'eslint'

import type { Node } from 'estree'

import { walkThisDeps } from './ast-utils.js'

import { findCyclicNames, kahnsTopologicalSort } from './kahns-sort.js'

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
  const cyclic = findCyclicNames(methods)
  for (const m of methods) {
    if (!m.name || cyclic.has(m.name)) continue
    if (methods.some((o) => o !== m && o.deps.has(m.name!) && o.idx > m.idx)) {
      report({ ctx, members, classBody, hasComputed, messageId: 'moveMemberBelow', target: m })
      return
    }
  }
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
  const methods = kahnsTopologicalSort(members.filter((m) => m.kind === 'method'))
  const result: MemberEntry[] = []
  if (ctor) result.push(ctor)
  result.push(...fields)
  result.push(...methods)
  return result
}

function collectMembers(body: Node[]): MemberEntry[] {
  return body.map((node, idx) => buildMemberEntry(node, idx))
}

function buildMemberEntry(node: Node, idx: number): MemberEntry {
  const kind = getMemberKind(node)
  const name = getMemberName(node)
  const deps = new Set<string>()
  walkThisDeps(node, deps)
  const accessibility = strReflect(node, 'accessibility')
  const isPublic =
    node.type === 'PropertyDefinition' &&
    (accessibility === 'public' || accessibility === undefined)
  const computed = Reflect.get(node, 'computed') === true
  return { node, idx, name, deps, kind, isPublic, computed }
}

interface MemberEntry {
  node: Node
  idx: number
  name: string | null
  deps: Set<string>
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
