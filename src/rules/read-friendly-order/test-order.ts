import type { CallExpression, ExpressionStatement, Program } from 'estree'
import type { Rule } from 'eslint'
import { createReplaceTextRangeFix, createSafeReorderFix } from './fixer-utils.js'
import { getTopLevelStatements, type TopLevelNode } from './index.js'

export function reportTestOrdering(program: Program, context: Rule.RuleContext): void {
  const entries = collectTestPhaseEntries(program)
  if (!entries.some((entry) => entry.kind === 'test')) {
    return
  }

  const fixRange = buildTestPhaseFixRange(entries, context)
  reportSetupOrder(entries, context, fixRange)
  reportTeardownOrder(entries, context, fixRange)
}

function buildTestPhaseFixRange(
  entries: TestPhaseEntry[],
  context: Rule.RuleContext,
): [number, number, string] | undefined {
  if (entries.length < 2) return undefined

  const ordered = getCanonicalPhaseEntries(entries)
  if (isSameOrder(entries, ordered)) return undefined

  const originalNodes = entries.map((entry) => entry.node)
  const orderedNodes = ordered.map((entry) => entry.node)
  return createSafeReorderFix(context.sourceCode, originalNodes, orderedNodes)
}

function getCanonicalPhaseEntries(entries: TestPhaseEntry[]): TestPhaseEntry[] {
  const setup = entries.filter((entry) => entry.kind === 'setup')
  const teardown = entries.filter((entry) => entry.kind === 'teardown')
  const tests = entries.filter((entry) => entry.kind === 'test')
  return [...setup, ...teardown, ...tests]
}

function isSameOrder(original: TestPhaseEntry[], candidate: TestPhaseEntry[]): boolean {
  if (original.length !== candidate.length) return false
  for (let i = 0; i < original.length; i += 1) {
    if (original[i]?.index !== candidate[i]?.index) return false
  }
  return true
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
  return getRootName(call.callee)
}

function getRootName(node: CallExpression['callee']): string | undefined {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression') return getRootName(node.object)
  if (node.type === 'CallExpression') return getRootName(node.callee)
  return undefined
}

function reportSetupOrder(
  entries: TestPhaseEntry[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const firstTeardown = findFirstIndex(entries, 'teardown')
  const firstTest = findFirstIndex(entries, 'test')

  for (const entry of entries) {
    if (entry.kind !== 'setup') continue

    if (firstTeardown >= 0 && entry.index > firstTeardown) {
      context.report({
        node: entry.node,
        messageId: 'setupBeforeTeardown',
        data: { hookName: entry.hookName },
        fix: createReplaceTextRangeFix(fixRange),
      })
      continue
    }

    if (firstTest >= 0 && entry.index > firstTest) {
      context.report({
        node: entry.node,
        messageId: 'setupBeforeTests',
        data: { hookName: entry.hookName },
        fix: createReplaceTextRangeFix(fixRange),
      })
    }
  }
}

function reportTeardownOrder(
  entries: TestPhaseEntry[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const firstTest = findFirstIndex(entries, 'test')
  if (firstTest < 0) return

  for (const entry of entries) {
    if (entry.kind !== 'teardown' || entry.index <= firstTest) continue

    context.report({
      node: entry.node,
      messageId: 'teardownBeforeTests',
      data: { hookName: entry.hookName },
      fix: createReplaceTextRangeFix(fixRange),
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
