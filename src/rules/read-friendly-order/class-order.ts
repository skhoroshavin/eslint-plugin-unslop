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
  for (const classNode of collectClassDeclarations(program)) {
    const members = collectClassMembers(classNode)
    const supportsFix = !hasUnsupportedClassMember(classNode)
    const fixRange = supportsFix ? buildClassFixRange(members, context) : undefined
    reportConstructorOrder(members, classNode, context, fixRange)
    reportPublicFieldOrder(members, context, fixRange)
    reportClassDependencyOrder(members, context, fixRange)
  }
}

function hasUnsupportedClassMember(classNode: ClassNode): boolean {
  for (const member of classNode.body.body) {
    if ('computed' in member && member.computed) return true
    if (
      'decorators' in member &&
      Array.isArray(member.decorators) &&
      member.decorators.length > 0
    ) {
      return true
    }
  }
  return false
}

function collectClassDeclarations(program: Program): ClassNode[] {
  const classes: ClassNode[] = []

  for (const statement of getTopLevelStatements(program)) {
    const classNode = extractClassNode(statement)
    if (classNode) classes.push(classNode)
  }

  return classes
}

function extractClassNode(statement: TopLevelNode): ClassNode | undefined {
  if (statement.type === 'ClassDeclaration') return statement

  if (
    statement.type === 'ExportNamedDeclaration' &&
    statement.declaration?.type === 'ClassDeclaration'
  ) {
    return statement.declaration
  }

  if (
    statement.type === 'ExportDefaultDeclaration' &&
    statement.declaration.type === 'ClassDeclaration'
  ) {
    return statement.declaration
  }

  return undefined
}

function reportConstructorOrder(
  members: ClassMemberEntry[],
  classNode: ClassNode,
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const ctor = members.find((m) => m.kind === 'constructor')
  if (!ctor || ctor.index === 0) return

  context.report({
    node: ctor.node,
    messageId: 'constructorFirst',
    data: { className: classNode.id?.name ?? 'anonymous class' },
    fix: createReplaceTextRangeFix(fixRange),
  })
}

function reportPublicFieldOrder(
  members: ClassMemberEntry[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const ctorIndex = members.find((m) => m.kind === 'constructor')?.index ?? -1
  const startIndex = ctorIndex >= 0 ? ctorIndex + 1 : 0
  let seenOther = false

  for (const member of members) {
    if (member.index < startIndex) continue

    if (member.kind === 'public-field') {
      if (seenOther) {
        context.report({
          node: member.node,
          messageId: 'publicFieldOrder',
          data: { memberName: member.name },
          fix: createReplaceTextRangeFix(fixRange),
        })
      }
      continue
    }

    seenOther = true
  }
}

function reportClassDependencyOrder(
  members: ClassMemberEntry[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const others = members.filter((m) => m.kind === 'other')

  for (const member of others) {
    const consumer = findFirstClassConsumer(others, member, context)
    if (!consumer) continue

    context.report({
      node: member.node,
      messageId: 'moveMemberBelow',
      data: { memberName: member.name, consumerName: consumer.name },
      fix: createReplaceTextRangeFix(fixRange),
    })
  }
}

function buildClassFixRange(
  members: ClassMemberEntry[],
  context: Rule.RuleContext,
): [number, number, string] | undefined {
  if (members.length < 2) return undefined

  const orderedMembers = getCanonicalClassMembers(members, context)
  if (!orderedMembers || isSameIndexOrder(members, orderedMembers)) return undefined

  const originalNodes = members.map((member) => member.node)
  const orderedNodes = orderedMembers.map((member) => member.node)
  return createSafeReorderFix(context.sourceCode, originalNodes, orderedNodes)
}

function getCanonicalClassMembers(
  members: ClassMemberEntry[],
  context: Rule.RuleContext,
): ClassMemberEntry[] | undefined {
  const constructorMembers = members.filter((member) => member.kind === 'constructor')
  const publicFields = members.filter((member) => member.kind === 'public-field')
  const others = members.filter((member) => member.kind === 'other')

  const orderedOthers = orderOtherMembers(others, context)
  if (!orderedOthers) return undefined

  return [...constructorMembers, ...publicFields, ...orderedOthers]
}

function orderOtherMembers(
  others: ClassMemberEntry[],
  context: Rule.RuleContext,
): ClassMemberEntry[] | undefined {
  const indexedOthers = others.map((member, indexInGroup) => ({ ...member, indexInGroup }))
  const edges = collectOtherMemberEdges(indexedOthers, context)
  if (edges.length === 0) return [...others]

  const order = stableTopologicalOrder(indexedOthers.length, edges)
  if (!order) return undefined
  return order.map((index) => indexedOthers[index])
}

function collectOtherMemberEdges(
  others: ClassMemberEntry[],
  context: Rule.RuleContext,
): Array<[number, number]> {
  const edges: Array<[number, number]> = []

  for (const member of others) {
    const consumer = findFirstClassConsumer(others, member, context)
    if (!consumer) continue
    edges.push([consumer.indexInGroup, member.indexInGroup])
  }

  return edges
}

function collectClassMembers(classNode: ClassNode): ClassMemberEntry[] {
  const members: ClassMemberEntry[] = []

  for (const [index, raw] of classNode.body.body.entries()) {
    const named = toNamedMember(raw)
    if (!named) continue
    members.push({
      name: named.name,
      node: named.node,
      index,
      indexInGroup: -1,
      kind: classifyMember(named.node),
    })
  }

  return members
}

function toNamedMember(raw: Node): { name: string; node: Node } | undefined {
  if (!hasMemberKey(raw)) return undefined
  const name = readMemberName(raw.key)
  return name ? { name, node: raw } : undefined
}

function hasMemberKey(value: object): value is { key: Node } {
  return 'key' in value && isNode(value.key)
}

function readMemberName(key: Node): string | undefined {
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value
  if (key.type === 'PrivateIdentifier') return `#${key.name}`
  return undefined
}

function classifyMember(member: Node): ClassMemberEntry['kind'] {
  if (member.type === 'MethodDefinition' && member.kind === 'constructor') return 'constructor'
  if (isPublicField(member)) return 'public-field'
  return 'other'
}

function isPublicField(member: Node): boolean {
  if (member.type !== 'PropertyDefinition' || member.static) return false
  if (member.key.type === 'PrivateIdentifier') return false
  if (!('accessibility' in member)) return true
  return member.accessibility === undefined || member.accessibility === 'public'
}

function findFirstClassConsumer(
  members: ClassMemberEntry[],
  member: ClassMemberEntry,
  context: Rule.RuleContext,
): ClassMemberEntry | undefined {
  const pattern = new RegExp(`\\bthis(?:\\?\\.|\\.)${escapeRegex(member.name)}\\b`)

  for (const candidate of members) {
    if (candidate.index <= member.index) continue
    if (pattern.test(context.sourceCode.getText(candidate.node))) return candidate
  }

  return undefined
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isNode(value: unknown): value is Node {
  return !!value && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
}

interface ClassNode {
  id?: Identifier | null
  body: ClassBody
}

interface ClassMemberEntry {
  name: string
  node: Node
  index: number
  indexInGroup: number
  kind: 'constructor' | 'public-field' | 'other'
}
