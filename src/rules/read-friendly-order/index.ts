import type { ExportNamedDeclaration, Node, Program, VariableDeclaration } from 'estree'
import type { Rule, Scope } from 'eslint'
import { reportClassOrdering } from './class-order.js'
import {
  createReplaceTextRangeFix,
  createSafeReorderFix,
  stableTopologicalOrder,
} from './fixer-utils.js'
import { reportTestOrdering } from './test-order.js'

const messages = {
  moveHelperBelow:
    'Place helper "{{helperName}}" below the top-level symbol "{{symbolName}}" that depends on it.',
  moveConstantBelow:
    'Place constant "{{constantName}}" below the top-level symbol "{{symbolName}}" that uses it.',
  constructorFirst: 'Place constructor first in class "{{className}}".',
  publicFieldOrder:
    'Place public field "{{memberName}}" right after constructor and before other class members.',
  moveMemberBelow:
    'Place class member "{{memberName}}" below member "{{consumerName}}" that depends on it.',
  setupBeforeTeardown: 'Place setup hook "{{hookName}}" before teardown hooks in this test file.',
  setupBeforeTests: 'Place setup hook "{{hookName}}" before test cases in this test file.',
  teardownBeforeTests: 'Place teardown hook "{{hookName}}" before test cases in this test file.',
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce top-level symbols before helper declarations they depend on',
      recommended: false,
    },
    schema: [],
    fixable: 'code',
    messages,
  },
  create(context: Rule.RuleContext) {
    return {
      Program(program) {
        reportTopLevelOrdering(program, context)
        reportClassOrdering(program, context)
        reportTestOrdering(program, context)
      },
    }
  },
} satisfies Rule.RuleModule

export type TopLevelNode = Program['body'][number]

function reportTopLevelOrdering(program: Program, context: Rule.RuleContext): void {
  const body = getTopLevelStatements(program)
  const helpers = collectHelpers(body)
  const refs = gatherAllRefs(context.sourceCode.scopeManager.globalScope)
  const cyclicNames = detectCyclicNames(helpers, body, refs)
  const eagerNames = detectEagerNames(body, helpers, refs)

  const fixRange = buildFixRange({ body, helpers, refs, cyclicNames, eagerNames, context })

  for (const h of helpers) {
    if (cyclicNames.has(h.name) || eagerNames.has(h.name)) continue
    const consumer = firstConsumerAfter(body, h, refs)
    if (!consumer) continue

    context.report({
      node: h.node,
      messageId: h.kind === 'constant' ? 'moveConstantBelow' : 'moveHelperBelow',
      data: {
        helperName: h.name,
        constantName: h.name,
        symbolName: symbolName(consumer.stmt),
      },
      fix: createReplaceTextRangeFix(fixRange),
    })
  }
}

export function getTopLevelStatements(program: Program): TopLevelNode[] {
  return program.body.filter((s) => s.type !== 'ImportDeclaration')
}

function buildFixRange(input: FixRangeInput): [number, number, string] | undefined {
  const { body, helpers, refs, cyclicNames, eagerNames, context } = input
  if (body.length < 2) return undefined

  const edges = collectEdges({ helpers, body, refs, cyclicNames, eagerNames })
  if (edges.length === 0) return undefined

  const order = stableTopologicalOrder(body.length, edges)
  if (!order || order.every((v, i) => v === i)) return undefined

  return createSafeReorderFix(
    context.sourceCode,
    body,
    order.map((i) => body[i]),
  )
}

function collectEdges(input: Omit<FixRangeInput, 'context'>): Array<[number, number]> {
  const { helpers, body, refs, cyclicNames, eagerNames } = input
  const edges: Array<[number, number]> = []
  for (const h of helpers) {
    if (cyclicNames.has(h.name) || eagerNames.has(h.name)) continue
    const c = firstConsumerAfter(body, h, refs)
    if (c) edges.push([c.index, h.index])
  }
  return edges
}

interface FixRangeInput {
  body: TopLevelNode[]
  helpers: Helper[]
  refs: Scope.Reference[]
  cyclicNames: Set<string>
  eagerNames: Set<string>
  context: Rule.RuleContext
}

function collectHelpers(body: TopLevelNode[]): Helper[] {
  const result: Helper[] = []
  for (const [index, stmt] of body.entries()) {
    result.push(...extractHelpers(stmt, index))
  }
  return result
}

function extractHelpers(stmt: TopLevelNode, index: number): Helper[] {
  const typeName = typeDeclarationName(stmt)
  if (typeName) return [{ name: typeName, node: stmt, index, kind: 'helper' }]

  if (stmt.type === 'FunctionDeclaration' && stmt.id) {
    return [{ name: stmt.id.name, node: stmt, index, kind: 'helper' }]
  }

  if (stmt.type === 'ExportNamedDeclaration') return extractExportedHelpers(stmt, index)
  if (stmt.type === 'VariableDeclaration') return varHelpers(stmt, index)
  return []
}

function extractExportedHelpers(stmt: ExportNamedDeclaration, index: number): Helper[] {
  const d = stmt.declaration
  if (!d) return []
  if (d.type === 'FunctionDeclaration' && d.id) {
    return [{ name: d.id.name, node: stmt, index, kind: 'helper' }]
  }
  if (d.type === 'VariableDeclaration') return varHelpers(d, index)
  return []
}

function typeDeclarationName(stmt: TopLevelNode): string | undefined {
  const t: string = stmt.type
  if (t !== 'TSTypeAliasDeclaration' && t !== 'TSInterfaceDeclaration') return undefined
  return hasIdentifierId(stmt) ? stmt.id.name : undefined
}

function hasIdentifierId(value: object): value is { id: { type: string; name: string } } {
  if (!('id' in value)) return false
  const { id } = value
  return !!id && typeof id === 'object' && 'type' in id && 'name' in id && id.type === 'Identifier'
}

function varHelpers(decl: VariableDeclaration, index: number): Helper[] {
  const out: Helper[] = []
  for (const d of decl.declarations) {
    if (d.id.type !== 'Identifier') continue
    const kind = classifyVarHelper(d.init ?? null, decl.kind)
    if (kind) out.push({ name: d.id.name, node: d, index, kind })
  }
  return out
}

function classifyVarHelper(init: Node | null, declKind: string): Helper['kind'] | undefined {
  if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') {
    return 'helper'
  }
  return declKind === 'const' ? 'constant' : undefined
}

function firstConsumerAfter(
  body: TopLevelNode[],
  helper: Helper,
  refs: Scope.Reference[],
): { stmt: TopLevelNode; index: number } | undefined {
  for (let i = helper.index + 1; i < body.length; i += 1) {
    const s = body[i]
    if (s.type === 'ExportNamedDeclaration' && !s.declaration) continue
    if (stmtUsesName(s, helper.name, refs)) return { stmt: s, index: i }
  }
  return undefined
}

function gatherAllRefs(scope: Scope.Scope | null): Scope.Reference[] {
  if (!scope) return []
  const out = [...scope.references]
  for (const child of scope.childScopes) out.push(...gatherAllRefs(child))
  return out
}

function detectCyclicNames(
  helpers: Helper[],
  body: TopLevelNode[],
  refs: Scope.Reference[],
): Set<string> {
  const deps = new Map<string, Set<string>>()
  for (const h of helpers) {
    const s = new Set<string>()
    for (const other of helpers) {
      if (other.name !== h.name && stmtUsesName(body[h.index], other.name, refs)) {
        s.add(other.name)
      }
    }
    deps.set(h.name, s)
  }

  const cyclic = new Set<string>()
  for (const h of helpers) {
    if (reachesSelf(h.name, deps)) cyclic.add(h.name)
  }
  return cyclic
}

function stmtUsesName(stmt: TopLevelNode, name: string, refs: Scope.Reference[]): boolean {
  if (!stmt.range) return false
  for (const ref of refs) {
    if (ref.identifier.name !== name) continue
    const r = ref.identifier.range
    if (r && r[0] >= stmt.range[0] && r[1] <= stmt.range[1]) return true
  }
  return false
}

function reachesSelf(start: string, deps: Map<string, Set<string>>): boolean {
  const visited = new Set<string>()
  const queue = [...(deps.get(start) ?? [])]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === start) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const d of deps.get(cur) ?? []) queue.push(d)
  }
  return false
}

function detectEagerNames(
  body: TopLevelNode[],
  helpers: Helper[],
  refs: Scope.Reference[],
): Set<string> {
  const helperNames = new Set(helpers.map((h) => h.name))
  const helperDeps = new Map<string, Set<string>>()
  for (const h of helpers) {
    const s = body[h.index]
    if (!s) continue
    const names = runtimeNamesIn(s, refs, helperNames)
    names.delete(h.name)
    helperDeps.set(h.name, names)
  }

  const roots = new Set<string>()
  for (const ref of refs) {
    if (!isRuntimeRead(ref, helperNames)) continue
    if (!isEagerTopLevelRef(ref, body)) continue
    roots.add(ref.identifier.name)
  }

  return reachableFrom(roots, helperDeps)
}

interface Helper {
  name: string
  node: Node
  index: number
  kind: 'helper' | 'constant'
}

function isEagerTopLevelRef(ref: Scope.Reference, body: TopLevelNode[]): boolean {
  if (ref.from.type !== 'module' && ref.from.type !== 'global') return false
  const stmt = body.find(
    (s) =>
      s.range &&
      ref.identifier.range &&
      ref.identifier.range[0] >= s.range[0] &&
      ref.identifier.range[1] <= s.range[1],
  )
  if (!stmt) return false
  return stmt.type !== 'ExportNamedDeclaration' || !!stmt.declaration
}

function runtimeNamesIn(
  stmt: TopLevelNode,
  refs: Scope.Reference[],
  helperNames: Set<string>,
): Set<string> {
  const names = new Set<string>()
  if (!stmt.range) return names
  for (const ref of refs) {
    if (!isRuntimeRead(ref, helperNames)) continue
    const r = ref.identifier.range
    if (r && r[0] >= stmt.range[0] && r[1] <= stmt.range[1]) {
      names.add(ref.identifier.name)
    }
  }
  return names
}

function isRuntimeRead(ref: Scope.Reference, helperNames: Set<string>): boolean {
  if ('isTypeReference' in ref && ref.isTypeReference === true) return false
  const isRead = typeof ref.isRead === 'function' ? ref.isRead() : true
  if (!isRead) return false
  return helperNames.has(ref.identifier.name)
}

function reachableFrom(roots: Set<string>, deps: Map<string, Set<string>>): Set<string> {
  const reached = new Set<string>()
  const queue = [...roots]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (reached.has(cur)) continue
    reached.add(cur)
    for (const d of deps.get(cur) ?? []) queue.push(d)
  }
  return reached
}

function symbolName(stmt: TopLevelNode): string {
  if (stmt.type === 'ExportDefaultDeclaration') return 'default export'
  if (stmt.type === 'ExportNamedDeclaration') return namedExportName(stmt)
  if (stmt.type === 'FunctionDeclaration' && stmt.id) return stmt.id.name
  if (stmt.type === 'VariableDeclaration') return firstVarName(stmt) ?? 'top-level statement'
  return 'top-level statement'
}

function namedExportName(stmt: ExportNamedDeclaration): string {
  const d = stmt.declaration
  if (!d) return 'named export'
  if (d.type === 'FunctionDeclaration' && d.id) return d.id.name
  if (d.type === 'VariableDeclaration') return firstVarName(d) ?? 'named export'
  return 'named export'
}

function firstVarName(decl: VariableDeclaration): string | undefined {
  const [first] = decl.declarations
  return first?.id.type === 'Identifier' ? first.id.name : undefined
}
