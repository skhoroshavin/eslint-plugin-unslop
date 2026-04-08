import type { Rule } from 'eslint'

import type { ClassBody, MethodDefinition, Node, PropertyDefinition } from 'estree'

import { walkThisDeps } from './ast-utils.js'

import { findCyclicNodes, kahnSort } from './graph-utils.js'

export function checkClass(ctx: Rule.RuleContext, classBody: Node): void {
  if (classBody.type !== 'ClassBody') return
  const analyzer = new ClassOrderAnalyzer(ctx, classBody)
  analyzer.analyze()
}

class ClassOrderAnalyzer {
  constructor(
    private readonly context: Rule.RuleContext,
    private readonly classBody: ClassBody,
  ) {
    const { body } = classBody
    if (body.length === 0) {
      this.members = []
      this.hasComputedMembers = false
      return
    }
    this.members = collectMembers(body)
    this.hasComputedMembers = this.members.some((member) => member.computed)
  }

  private readonly members: MemberEntry[]
  private readonly hasComputedMembers: boolean

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
    const cyclic = findCyclicNodes(methods)
    for (const method of methods) {
      if (!method.name || cyclic.has(method.name)) continue
      if (
        methods.some(
          (other) => other !== method && other.deps.has(method.name!) && other.idx > method.idx,
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

function buildClassFix(
  ctx: Rule.RuleContext,
  members: MemberEntry[],
  classBody: ClassBody,
): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const src = ctx.sourceCode
    const sorted = sortMembers(members)
    const texts = sorted.map((m) => src.getText(m.node))
    const { body } = classBody
    const first = body[0]
    const last = body[body.length - 1]
    return fixer.replaceTextRange([first.range![0], last.range![1]], texts.join('\n\n'))
  }
}

function sortMembers(members: MemberEntry[]): MemberEntry[] {
  const ctor = members.find((m) => m.kind === 'constructor')
  const fields = members.filter((m) => m.isPublic && m.kind !== 'constructor')
  const methods = kahnSort(
    members.filter((m) => m.kind === 'method'),
    (a, b) => a.idx - b.idx,
  )
  const result: MemberEntry[] = []
  if (ctor) result.push(ctor)
  result.push(...fields)
  result.push(...methods)
  return result
}

function collectMembers(body: ClassBody['body']): MemberEntry[] {
  return body.flatMap((node, idx) => {
    if (node.type === 'StaticBlock') return []
    return [collectMember(node, idx)]
  })
}

function collectMember(node: ClassMember, idx: number): MemberEntry {
  const kind = getMemberKind(node)
  const name = getMemberName(node)
  const deps = new Set<string>()
  walkThisDeps(node, deps)
  const accessibility = strProp(node, 'accessibility')
  const isPublic =
    node.type === 'PropertyDefinition' &&
    (accessibility === 'public' || accessibility === undefined)
  return { node, idx, name, deps, kind, isPublic, computed: node.computed }
}

function strProp(obj: unknown, key: string): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined
  const value = Reflect.get(obj, key)
  return typeof value === 'string' ? value : undefined
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

function getMemberKind(node: ClassMember): 'constructor' | 'field' | 'method' {
  if (node.type === 'MethodDefinition') {
    return node.kind === 'constructor' ? 'constructor' : 'method'
  }
  return 'field'
}

function getMemberName(node: ClassMember): string | null {
  const { key } = node
  if (key.type === 'Identifier') return key.name
  return null
}

type ClassMember = MethodDefinition | PropertyDefinition
