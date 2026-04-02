import type { CallExpression, ExpressionStatement, Program } from 'estree'
import type { Rule } from 'eslint'
import { createReplaceTextRangeFix, createSafeReorderFix, isSameIndexOrder } from './fixer-utils.js'
import { getTopLevelStatements } from './index.js'

export function reportTestOrdering(program: Program, context: Rule.RuleContext): void {
  const entries = collectEntries(program)
  if (!entries.some((e) => e.kind === 'test')) return

  const fixRange = buildTestFix(entries, context)
  reportSetup(entries, context, fixRange)
  reportTeardown(entries, context, fixRange)
}

function collectEntries(program: Program): Entry[] {
  const out: Entry[] = []
  for (const [index, stmt] of getTopLevelStatements(program).entries()) {
    if (stmt.type !== 'ExpressionStatement' || stmt.expression.type !== 'CallExpression') continue
    const name = callRootName(stmt.expression)
    if (!name) continue
    const kind = classify(name)
    if (kind) out.push({ index, kind, hookName: name, node: stmt })
  }
  return out
}

function classify(name: string): Entry['kind'] | undefined {
  if (SETUP.has(name)) return 'setup'
  if (TEARDOWN.has(name)) return 'teardown'
  if (TESTS.has(name)) return 'test'
  return undefined
}

const SETUP = new Set(['beforeAll', 'beforeEach', 'before'])

const TEARDOWN = new Set(['afterAll', 'afterEach', 'after'])

const TESTS = new Set(['test', 'it'])

function callRootName(call: CallExpression): string | undefined {
  const c = call.callee
  if (c.type === 'Identifier') return c.name
  if (c.type === 'MemberExpression') return rootName(c.object)
  if (c.type === 'CallExpression') return callRootName(c)
  return undefined
}

function rootName(node: CallExpression['callee']): string | undefined {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression') return rootName(node.object)
  if (node.type === 'CallExpression') return callRootName(node)
  return undefined
}

function buildTestFix(
  entries: Entry[],
  context: Rule.RuleContext,
): [number, number, string] | undefined {
  if (entries.length < 2) return undefined
  const ordered = canonicalEntries(entries)
  if (isSameIndexOrder(entries, ordered)) return undefined
  return createSafeReorderFix(
    context.sourceCode,
    entries.map((e) => e.node),
    ordered.map((e) => e.node),
  )
}

function canonicalEntries(entries: Entry[]): Entry[] {
  return [
    ...entries.filter((e) => e.kind === 'setup'),
    ...entries.filter((e) => e.kind === 'teardown'),
    ...entries.filter((e) => e.kind === 'test'),
  ]
}

function reportSetup(
  entries: Entry[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const firstTeardown = firstIndexOf(entries, 'teardown')
  const firstTest = firstIndexOf(entries, 'test')

  for (const e of entries) {
    if (e.kind !== 'setup') continue
    if (firstTeardown >= 0 && e.index > firstTeardown) {
      context.report({
        node: e.node,
        messageId: 'setupBeforeTeardown',
        data: { hookName: e.hookName },
        fix: createReplaceTextRangeFix(fixRange),
      })
      continue
    }
    if (firstTest >= 0 && e.index > firstTest) {
      context.report({
        node: e.node,
        messageId: 'setupBeforeTests',
        data: { hookName: e.hookName },
        fix: createReplaceTextRangeFix(fixRange),
      })
    }
  }
}

function reportTeardown(
  entries: Entry[],
  context: Rule.RuleContext,
  fixRange: [number, number, string] | undefined,
): void {
  const firstTest = firstIndexOf(entries, 'test')
  if (firstTest < 0) return
  for (const e of entries) {
    if (e.kind !== 'teardown' || e.index <= firstTest) continue
    context.report({
      node: e.node,
      messageId: 'teardownBeforeTests',
      data: { hookName: e.hookName },
      fix: createReplaceTextRangeFix(fixRange),
    })
  }
}

function firstIndexOf(entries: Entry[], kind: Entry['kind']): number {
  const match = entries.find((e) => e.kind === kind)
  return match ? match.index : -1
}

interface Entry {
  index: number
  kind: 'setup' | 'teardown' | 'test'
  hookName: string
  node: ExpressionStatement
}
