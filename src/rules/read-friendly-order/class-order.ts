import type { ClassBody, Identifier, Node, Program } from 'estree'
import type { Rule } from 'eslint'
import { getTopLevelStatements, type TopLevelNode } from '../read-friendly-order.js'

export function reportClassOrdering(program: Program, context: Rule.RuleContext): void {
  for (const classNode of collectClassDeclarations(program)) {
    const members = collectClassMembers(classNode)
    reportConstructorOrder(members, classNode, context)
    reportPublicFieldOrder(members, context)
    reportClassDependencyOrder(members, context)
  }
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
): void {
  const ctor = members.find((m) => m.kind === 'constructor')
  if (!ctor || ctor.index === 0) return

  context.report({
    node: ctor.node,
    messageId: 'constructorFirst',
    data: { className: classNode.id?.name ?? 'anonymous class' },
  })
}

function reportPublicFieldOrder(members: ClassMemberEntry[], context: Rule.RuleContext): void {
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
        })
      }
      continue
    }

    seenOther = true
  }
}

function reportClassDependencyOrder(members: ClassMemberEntry[], context: Rule.RuleContext): void {
  const others = members.filter((m) => m.kind === 'other')

  for (const member of others) {
    const consumer = findFirstClassConsumer(others, member, context)
    if (!consumer) continue

    context.report({
      node: member.node,
      messageId: 'moveMemberBelow',
      data: { memberName: member.name, consumerName: consumer.name },
    })
  }
}

function collectClassMembers(classNode: ClassNode): ClassMemberEntry[] {
  const members: ClassMemberEntry[] = []

  for (const [index, raw] of classNode.body.body.entries()) {
    const named = toNamedMember(raw)
    if (!named) continue
    members.push({ name: named.name, node: named.node, index, kind: classifyMember(named.node) })
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
  kind: 'constructor' | 'public-field' | 'other'
}
