import type { ClassBody, Identifier, Node, Program } from 'estree'
import type { Rule } from 'eslint'
import {
  createReplaceTextRangeFix,
  createSafeReorderFix,
  isSameIndexOrder,
  stableTopologicalOrder,
} from './fixer-utils.js'
import { getTopLevelStatements, type TopLevelNode } from './index.js'

export function reportClassOrdering(program: Program, context: Rule.RuleContext): void {
  for (const cls of findClasses(program)) {
    const members = collectMembers(cls)
    const canFix = !hasUnsupportedMember(cls)
    const fixRange = canFix ? buildClassFix(members, context) : undefined
    reportConstructor(members, cls, context, fixRange)
    reportPublicFields(members, context, fixRange)
    reportDependencyOrder(members, context, fixRange)
  }
}

function findClasses(program: Program): ClassNode[] {
  const out: ClassNode[] = []
  for (const stmt of getTopLevelStatements(program)) {
    const cls = extractClass(stmt)
    if (cls) out.push(cls)
  }
  return out
}

function extractClass(stmt: TopLevelNode): ClassNode | undefined {
  if (stmt.type === 'ClassDeclaration') return stmt
  if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration?.type === 'ClassDeclaration') {
    return stmt.declaration
  }
  if (stmt.type === 'ExportDefaultDeclaration' && stmt.declaration.type === 'ClassDeclaration') {
    return stmt.declaration
  }
  return undefined
}

function hasUnsupportedMember(cls: ClassNode): boolean {
  for (const m of cls.body.body) {
    if ('computed' in m && m.computed) return true
    if ('decorators' in m && Array.isArray(m.decorators) && m.decorators.length > 0) return true
  }
  return false
}

function collectMembers(cls: ClassNode): Member[] {
  const out: Member[] = []
  for (const [index, raw] of cls.body.body.entries()) {
    if (!hasMemberKey(raw)) continue
    const name = memberName(raw.key)
    if (!name) continue
    out.push({ name, node: raw, index, indexInGroup: -1, kind: classifyMember(raw) })
  }
  return out
}

function hasMemberKey(value: object): value is Node & { key: Node } {
  return 'key' in value && isNode(value.key)
}

function isNode(value: unknown): value is Node {
  return !!value && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

function memberName(key: Node): string | undefined {
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value
  if (key.type === 'PrivateIdentifier') return `#${key.name}`
  return undefined
}

function classifyMember(m: Node & { key: Node }): Member['kind'] {
  if (m.type === 'MethodDefinition' && hasKind(m, 'constructor')) return 'constructor'
  if (isPublicField(m)) return 'public-field'
  return 'other'
}

function hasKind(value: object, kind: string): boolean {
  return 'kind' in value && value.kind === kind
}

function isPublicField(m: Node & { key: Node }): boolean {
  if (m.type !== 'PropertyDefinition') return false
  if ('static' in m && m.static) return false
  if (m.key.type === 'PrivateIdentifier') return false
  if (!('accessibility' in m)) return true
  return m.accessibility === undefined || m.accessibility === 'public'
}

function reportConstructor(
  members: Member[],
  cls: ClassNode,
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const ctor = members.find((m) => m.kind === 'constructor')
  if (!ctor || ctor.index === 0) return
  context.report({
    node: ctor.node,
    messageId: 'constructorFirst',
    data: { className: cls.id?.name ?? 'anonymous class' },
    fix: createReplaceTextRangeFix(fixRange),
  })
}

interface ClassNode {
  id?: Identifier | null
  body: ClassBody
}

function reportPublicFields(
  members: Member[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const ctorIdx = members.find((m) => m.kind === 'constructor')?.index ?? -1
  const startAfter = ctorIdx >= 0 ? ctorIdx + 1 : 0
  let seenOther = false

  for (const m of members) {
    if (m.index < startAfter) continue
    if (m.kind === 'public-field') {
      if (seenOther) {
        context.report({
          node: m.node,
          messageId: 'publicFieldOrder',
          data: { memberName: m.name },
          fix: createReplaceTextRangeFix(fixRange),
        })
      }
      continue
    }
    seenOther = true
  }
}

function reportDependencyOrder(
  members: Member[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const others = members.filter((m) => m.kind === 'other')
  for (const m of others) {
    const consumer = firstClassConsumer(others, m, context)
    if (!consumer) continue
    context.report({
      node: m.node,
      messageId: 'moveMemberBelow',
      data: { memberName: m.name, consumerName: consumer.name },
      fix: createReplaceTextRangeFix(fixRange),
    })
  }
}

function buildClassFix(
  members: Member[],
  context: Rule.RuleContext,
): [number, number, string] | undefined {
  if (members.length < 2) return undefined

  const canonical = canonicalOrder(members, context)
  if (!canonical || isSameIndexOrder(members, canonical)) return undefined

  return createSafeReorderFix(
    context.sourceCode,
    members.map((m) => m.node),
    canonical.map((m) => m.node),
  )
}

function canonicalOrder(members: Member[], context: Rule.RuleContext): Member[] | undefined {
  const ctors = members.filter((m) => m.kind === 'constructor')
  const pubFields = members.filter((m) => m.kind === 'public-field')
  const others = members.filter((m) => m.kind === 'other')

  const orderedOthers = orderOthers(others, context)
  if (!orderedOthers) return undefined

  return [...ctors, ...pubFields, ...orderedOthers]
}

function orderOthers(others: Member[], context: Rule.RuleContext): Member[] | undefined {
  const indexed = others.map((m, i) => ({ ...m, indexInGroup: i }))
  const edges: Array<[number, number]> = []
  for (const m of indexed) {
    const consumer = firstClassConsumer(indexed, m, context)
    if (consumer) edges.push([consumer.indexInGroup, m.indexInGroup])
  }
  if (edges.length === 0) return [...others]
  const order = stableTopologicalOrder(indexed.length, edges)
  if (!order) return undefined
  return order.map((i) => indexed[i])
}

function firstClassConsumer(
  members: Member[],
  member: Member,
  context: Rule.RuleContext,
): Member | undefined {
  const pattern = new RegExp(`\\bthis(?:\\?\\.|\\.)${escapeRe(member.name)}\\b`)
  for (const candidate of members) {
    if (candidate.index <= member.index) continue
    if (pattern.test(context.sourceCode.getText(candidate.node))) return candidate
  }
  return undefined
}

interface Member {
  name: string
  node: Node
  index: number
  indexInGroup: number
  kind: 'constructor' | 'public-field' | 'other'
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
