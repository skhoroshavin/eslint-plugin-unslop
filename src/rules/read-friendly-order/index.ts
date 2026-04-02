import type { ExportNamedDeclaration, Node, Program, VariableDeclaration } from 'estree'
import type { Rule, Scope } from 'eslint'
import { reportClassOrdering } from './class-order.js'
import {
  createReplaceTextRangeFix,
  createSafeReorderFix,
  stableTopologicalOrder,
} from './fixer-utils.js'
import { reportTestOrdering } from './test-order.js'

const READ_FRIENDLY_ORDER_MESSAGES = {
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
    messages: READ_FRIENDLY_ORDER_MESSAGES,
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
  const refs = collectReferences(context.sourceCode.scopeManager.globalScope)
  const cyclicNames = findCyclicHelperNames(body, helpers, refs)
  const eagerHelperNames = findEagerHelperNames(body, helpers, refs)
  const fixRange = buildTopLevelFixRange({
    body,
    helpers,
    refs,
    cyclicNames,
    eagerHelperNames,
    context,
  })

  for (const helper of helpers) {
    if (cyclicNames.has(helper.name)) continue
    if (eagerHelperNames.has(helper.name)) continue

    const consumer = findFirstConsumerEntry(body, helper, refs)?.statement
    if (!consumer) continue

    context.report({
      node: helper.node,
      messageId: helper.kind === 'constant' ? 'moveConstantBelow' : 'moveHelperBelow',
      data: {
        helperName: helper.name,
        constantName: helper.name,
        symbolName: getSymbolName(consumer),
      },
      fix: createReplaceTextRangeFix(fixRange),
    })
  }
}

function buildTopLevelFixRange(input: TopLevelFixInput): [number, number, string] | undefined {
  const { body, helpers, refs, cyclicNames, eagerHelperNames, context } = input
  if (body.length < 2) return undefined

  const edges = collectTopLevelEdges(body, helpers, refs, cyclicNames, eagerHelperNames)
  if (edges.length === 0) return undefined

  const order = stableTopologicalOrder(body.length, edges)
  if (!order || isIdentityOrder(order)) return undefined

  const orderedBody = order.map((index) => body[index])
  return createSafeReorderFix(context.sourceCode, body, orderedBody)
}

function collectTopLevelEdges(
  body: TopLevelNode[],
  helpers: HelperDeclaration[],
  refs: Scope.Reference[],
  cyclicNames: Set<string>,
  eagerHelperNames: Set<string>,
): Array<[number, number]> {
  const edges: Array<[number, number]> = []

  for (const helper of helpers) {
    if (cyclicNames.has(helper.name) || eagerHelperNames.has(helper.name)) continue
    const consumer = findFirstConsumerEntry(body, helper, refs)
    if (!consumer) continue
    edges.push([consumer.index, helper.index])
  }

  return edges
}

function isIdentityOrder(order: number[]): boolean {
  return order.every((value, index) => index === value)
}

export function getTopLevelStatements(program: Program): TopLevelNode[] {
  return program.body.filter((s) => s.type !== 'ImportDeclaration')
}

function collectHelpers(body: TopLevelNode[]): HelperDeclaration[] {
  const helpers: HelperDeclaration[] = []
  for (const [index, statement] of body.entries()) {
    helpers.push(...collectHelperEntries(statement, index))
  }
  return helpers
}

function collectHelperEntries(statement: TopLevelNode, index: number): HelperDeclaration[] {
  const typeName = getTypeDeclarationName(statement)
  if (typeName) return [{ name: typeName, node: statement, index, kind: 'helper' }]

  if (statement.type === 'FunctionDeclaration' && statement.id) {
    return [{ name: statement.id.name, node: statement, index, kind: 'helper' }]
  }

  if (statement.type === 'ExportNamedDeclaration') {
    return collectExportedHelpers(statement, index)
  }

  if (statement.type === 'VariableDeclaration') {
    return collectVariableHelpers(statement, index)
  }

  return []
}

function getTypeDeclarationName(statement: TopLevelNode): string | undefined {
  const t: string = statement.type
  if (t !== 'TSTypeAliasDeclaration' && t !== 'TSInterfaceDeclaration') return undefined
  return hasIdentifierId(statement) ? statement.id.name : undefined
}

function hasIdentifierId(value: object): value is { id: { type: string; name: string } } {
  if (!('id' in value)) return false
  const { id } = value
  return !!id && typeof id === 'object' && 'type' in id && 'name' in id && id.type === 'Identifier'
}

function collectExportedHelpers(
  statement: ExportNamedDeclaration,
  index: number,
): HelperDeclaration[] {
  const decl = statement.declaration
  if (!decl) return []

  if (decl.type === 'FunctionDeclaration' && decl.id) {
    return [{ name: decl.id.name, node: statement, index, kind: 'helper' }]
  }

  if (decl.type === 'VariableDeclaration') return collectVariableHelpers(decl, index)
  return []
}

function collectVariableHelpers(decl: VariableDeclaration, index: number): HelperDeclaration[] {
  const helpers: HelperDeclaration[] = []

  for (const item of decl.declarations) {
    if (item.id.type !== 'Identifier') continue
    const isFn = isFunctionInit(item.init ?? null)

    if (!isFn && decl.kind !== 'const') continue

    helpers.push({
      name: item.id.name,
      node: item,
      index,
      kind: isFn ? 'helper' : 'constant',
    })
  }

  return helpers
}

function isFunctionInit(node: Node | null): boolean {
  return node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression'
}

function findFirstConsumerEntry(
  body: TopLevelNode[],
  helper: HelperDeclaration,
  refs: Scope.Reference[],
): { statement: TopLevelNode; index: number } | undefined {
  for (let i = helper.index + 1; i < body.length; i += 1) {
    const stmt = body[i]
    if (stmt.type === 'ExportNamedDeclaration' && !stmt.declaration) continue
    if (statementUsesName(stmt, helper.name, refs)) return { statement: stmt, index: i }
  }
  return undefined
}

function findCyclicHelperNames(
  body: TopLevelNode[],
  helpers: HelperDeclaration[],
  refs: Scope.Reference[],
): Set<string> {
  const deps = new Map<string, Set<string>>()

  for (const helper of helpers) {
    const helperDeps = new Set<string>()
    for (const other of helpers) {
      if (other.name !== helper.name && statementUsesName(body[helper.index], other.name, refs)) {
        helperDeps.add(other.name)
      }
    }
    deps.set(helper.name, helperDeps)
  }

  const cyclic = new Set<string>()
  for (const helper of helpers) {
    if (canReachSelf(helper.name, deps)) cyclic.add(helper.name)
  }
  return cyclic
}

function statementUsesName(
  statement: TopLevelNode,
  name: string,
  refs: Scope.Reference[],
): boolean {
  const range = statement.range
  if (!range) return false

  for (const ref of refs) {
    if (ref.identifier.name !== name) continue
    const idRange = ref.identifier.range
    if (!idRange) continue
    if (idRange[0] >= range[0] && idRange[1] <= range[1]) return true
  }

  return false
}

function canReachSelf(start: string, deps: Map<string, Set<string>>): boolean {
  const visited = new Set<string>()
  const queue = [...(deps.get(start) ?? [])]

  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (current === start) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const dep of deps.get(current) ?? []) queue.push(dep)
  }

  return false
}

function collectReferences(scope: Scope.Scope | null): Scope.Reference[] {
  if (!scope) return []
  const refs = [...scope.references]
  for (const child of scope.childScopes) {
    refs.push(...collectReferences(child))
  }
  return refs
}

function findEagerHelperNames(
  body: TopLevelNode[],
  helpers: HelperDeclaration[],
  refs: Scope.Reference[],
): Set<string> {
  const helperNames = new Set(helpers.map((helper) => helper.name))
  const deps = collectHelperRuntimeDependencies(body, helpers, refs, helperNames)
  const roots = collectEagerRootNames(body, refs, helperNames)
  return collectReachableNames(roots, deps)
}

function collectHelperRuntimeDependencies(
  body: TopLevelNode[],
  helpers: HelperDeclaration[],
  refs: Scope.Reference[],
  helperNames: Set<string>,
): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>()
  for (const helper of helpers) {
    const statement = body[helper.index]
    const names = collectRuntimeNamesInStatement(statement, refs, helperNames)
    names.delete(helper.name)
    deps.set(helper.name, names)
  }
  return deps
}

function collectEagerRootNames(
  body: TopLevelNode[],
  refs: Scope.Reference[],
  helperNames: Set<string>,
): Set<string> {
  const roots = new Set<string>()

  for (const ref of refs) {
    if (isTypeReference(ref)) continue
    if (!isReadReference(ref)) continue
    const name = ref.identifier.name
    if (!helperNames.has(name)) continue
    if (!isEagerRefInTopLevelStatement(ref, body)) continue
    roots.add(name)
  }

  return roots
}

function isEagerRefInTopLevelStatement(ref: Scope.Reference, body: TopLevelNode[]): boolean {
  if (ref.from.type !== 'module' && ref.from.type !== 'global') return false
  const statement = findTopLevelStatementForRef(body, ref)
  if (!statement) return false
  return statement.type !== 'ExportNamedDeclaration' || !!statement.declaration
}

function findTopLevelStatementForRef(
  body: TopLevelNode[],
  ref: Scope.Reference,
): TopLevelNode | undefined {
  const idRange = ref.identifier.range
  if (!idRange) return undefined
  return body.find((statement) => isRangeInsideStatement(idRange, statement))
}

function collectRuntimeNamesInStatement(
  statement: TopLevelNode | undefined,
  refs: Scope.Reference[],
  helperNames: Set<string>,
): Set<string> {
  const names = new Set<string>()
  const range = statement?.range
  if (!range) return names

  for (const ref of refs) {
    if (isTypeReference(ref)) continue
    if (!isReadReference(ref)) continue
    const name = ref.identifier.name
    if (!helperNames.has(name)) continue
    if (!isRangeInsideStatement(ref.identifier.range, statement)) continue
    names.add(name)
  }

  return names
}

function isRangeInsideStatement(
  range: [number, number] | undefined,
  statement: TopLevelNode,
): boolean {
  if (!range || !statement.range) return false
  return range[0] >= statement.range[0] && range[1] <= statement.range[1]
}

function collectReachableNames(roots: Set<string>, deps: Map<string, Set<string>>): Set<string> {
  const reachable = new Set<string>()
  const queue = [...roots]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || reachable.has(current)) continue
    reachable.add(current)
    for (const dep of deps.get(current) ?? []) queue.push(dep)
  }

  return reachable
}

function isTypeReference(ref: Scope.Reference): boolean {
  return 'isTypeReference' in ref && ref.isTypeReference === true
}

function isReadReference(ref: Scope.Reference): boolean {
  return typeof ref.isRead === 'function' ? ref.isRead() : true
}

function getSymbolName(statement: TopLevelNode): string {
  if (statement.type === 'ExportDefaultDeclaration') return 'default export'
  if (statement.type === 'ExportNamedDeclaration') return getNamedExportName(statement)
  if (statement.type === 'FunctionDeclaration' && statement.id) return statement.id.name
  if (statement.type === 'VariableDeclaration')
    return getVarName(statement) ?? 'top-level statement'
  return 'top-level statement'
}

function getNamedExportName(statement: ExportNamedDeclaration): string {
  const decl = statement.declaration
  if (!decl) return 'named export'
  if (decl.type === 'FunctionDeclaration' && decl.id) return decl.id.name
  if (decl.type === 'VariableDeclaration') return getVarName(decl) ?? 'named export'
  return 'named export'
}

function getVarName(decl: VariableDeclaration): string | undefined {
  const [first] = decl.declarations
  return first?.id.type === 'Identifier' ? first.id.name : undefined
}

interface TopLevelFixInput {
  body: TopLevelNode[]
  helpers: HelperDeclaration[]
  refs: Scope.Reference[]
  cyclicNames: Set<string>
  eagerHelperNames: Set<string>
  context: Rule.RuleContext
}

interface HelperDeclaration {
  name: string
  node: Node
  index: number
  kind: 'helper' | 'constant'
}
