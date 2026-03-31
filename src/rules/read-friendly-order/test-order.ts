import type { CallExpression, ExpressionStatement, Program } from 'estree'
import type { Rule } from 'eslint'
import { getTopLevelStatements, type TopLevelNode } from '../read-friendly-order.js'

export function reportTestOrdering(program: Program, context: Rule.RuleContext): void {
  const entries = collectTestPhaseEntries(program)
  if (!entries.some((entry) => entry.kind === 'test')) {
    return
  }

  reportSetupOrder(entries, context)
  reportTeardownOrder(entries, context)
}

function collectTestPhaseEntries(program: Program): TestPhaseEntry[] {
  const entries: TestPhaseEntry[] = []

  for (const [index, statement] of getTopLevelStatements(program).entries()) {
    const entry = toTestPhaseEntry(statement, index)
    if (entry) {
      entries.push(entry)
    }
  }

  return entries
}

function toTestPhaseEntry(statement: TopLevelNode, index: number): TestPhaseEntry | undefined {
  if (statement.type !== 'ExpressionStatement' || statement.expression.type !== 'CallExpression') {
    return undefined
  }

  const rootName = getCallRootName(statement.expression)
  if (!rootName) {
    return undefined
  }

  const kind = classifyHookName(rootName)
  if (!kind) {
    return undefined
  }

  return { index, kind, hookName: rootName, node: statement }
}

function classifyHookName(name: string): TestPhaseEntry['kind'] | undefined {
  if (SETUP_HOOKS.has(name)) return 'setup'
  if (TEARDOWN_HOOKS.has(name)) return 'teardown'
  if (TEST_CALLS.has(name)) return 'test'
  return undefined
}

const SETUP_HOOKS = new Set(['beforeAll', 'beforeEach', 'before'])
const TEARDOWN_HOOKS = new Set(['afterAll', 'afterEach', 'after'])
const TEST_CALLS = new Set(['test', 'it'])

function getCallRootName(call: CallExpression): string | undefined {
  const callee = call.callee
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression') return readObjectRoot(callee.object)
  if (callee.type === 'CallExpression') return getCallRootName(callee)
  return undefined
}

function readObjectRoot(node: CallExpression['callee']): string | undefined {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression') return readObjectRoot(node.object)
  if (node.type === 'CallExpression') return getCallRootName(node)
  return undefined
}

function reportSetupOrder(entries: TestPhaseEntry[], context: Rule.RuleContext): void {
  const firstTeardown = findFirstIndex(entries, 'teardown')
  const firstTest = findFirstIndex(entries, 'test')

  for (const entry of entries) {
    if (entry.kind !== 'setup') continue

    if (firstTeardown >= 0 && entry.index > firstTeardown) {
      context.report({
        node: entry.node,
        messageId: 'setupBeforeTeardown',
        data: { hookName: entry.hookName },
      })
      continue
    }

    if (firstTest >= 0 && entry.index > firstTest) {
      context.report({
        node: entry.node,
        messageId: 'setupBeforeTests',
        data: { hookName: entry.hookName },
      })
    }
  }
}

function reportTeardownOrder(entries: TestPhaseEntry[], context: Rule.RuleContext): void {
  const firstTest = findFirstIndex(entries, 'test')
  if (firstTest < 0) return

  for (const entry of entries) {
    if (entry.kind !== 'teardown' || entry.index <= firstTest) continue

    context.report({
      node: entry.node,
      messageId: 'teardownBeforeTests',
      data: { hookName: entry.hookName },
    })
  }
}

function findFirstIndex(entries: TestPhaseEntry[], kind: TestPhaseEntry['kind']): number {
  const match = entries.find((entry) => entry.kind === kind)
  return match ? match.index : -1
}

interface TestPhaseEntry {
  index: number
  kind: 'setup' | 'teardown' | 'test'
  hookName: string
  node: ExpressionStatement
}
