/* eslint-disable complexity, unslop/read-friendly-order */
import type { Rule } from 'eslint'
import type { Node, Program } from 'estree'

type Phase = 'setup' | 'teardown' | 'test'

interface PhaseCall {
  node: Node
  phase: Phase
  idx: number
}

const SETUP = new Set(['beforeAll', 'beforeEach'])
const TEARDOWN = new Set(['afterAll', 'afterEach'])
const TESTS = new Set(['test', 'it', 'describe'])

export function checkTestPhases(ctx: Rule.RuleContext, p: Program): void {
  const calls = collectTestCalls(p)
  if (calls.length === 0) return

  const firstSetup = calls.find((c) => c.phase === 'setup')
  const firstTeardown = calls.find((c) => c.phase === 'teardown')
  const firstTest = calls.find((c) => c.phase === 'test')

  if (firstSetup && firstTeardown && firstTeardown.idx < firstSetup.idx) {
    ctx.report({
      node: firstTeardown.node,
      messageId: 'setupBeforeTeardown',
      fix: buildPhaseFix(ctx, p, calls),
    })
    return
  }
  if (firstSetup && firstTest && firstTest.idx < firstSetup.idx) {
    ctx.report({
      node: firstSetup.node,
      messageId: 'setupBeforeTests',
      fix: buildPhaseFix(ctx, p, calls),
    })
  }
}

function collectTestCalls(p: Program): PhaseCall[] {
  const calls: PhaseCall[] = []
  for (let i = 0; i < p.body.length; i++) {
    const phase = getPhase(p.body[i])
    if (phase) {
      calls.push({ node: p.body[i], phase, idx: i })
    }
  }
  return calls
}

function getPhase(stmt: Node): Phase | null {
  if (stmt.type !== 'ExpressionStatement') return null
  const expr = Reflect.get(stmt, 'expression')
  if (!expr || typeof expr !== 'object') return null
  if (Reflect.get(expr, 'type') !== 'CallExpression') return null
  const callee = Reflect.get(expr, 'callee')
  if (!callee || typeof callee !== 'object') return null
  if (Reflect.get(callee, 'type') !== 'Identifier') return null
  const name = Reflect.get(callee, 'name')
  return typeof name === 'string' ? classifyCallee(name) : null
}

function classifyCallee(name: string): Phase | null {
  if (SETUP.has(name)) return 'setup'
  if (TEARDOWN.has(name)) return 'teardown'
  if (TESTS.has(name)) return 'test'
  return null
}

function buildPhaseFix(
  ctx: Rule.RuleContext,
  p: Program,
  calls: PhaseCall[],
): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const ordered = buildPhaseOrder(p, calls)
    const text = ordered.map((entry) => ctx.sourceCode.getText(entry.node)).join('\n\n')
    return fixer.replaceTextRange([p.range![0], p.range![1]], text)
  }
}

function buildPhaseOrder(p: Program, calls: PhaseCall[]): Array<{ node: Node; idx: number }> {
  const callsByIndex = new Map(calls.map((call) => [call.idx, call]))
  const others: Array<{ node: Node; idx: number }> = []
  const setups: Array<{ node: Node; idx: number }> = []
  const teardowns: Array<{ node: Node; idx: number }> = []
  const tests: Array<{ node: Node; idx: number }> = []
  for (let i = 0; i < p.body.length; i++) {
    const call = callsByIndex.get(i)
    if (!call) others.push({ node: p.body[i], idx: i })
    else if (call.phase === 'setup') setups.push({ node: p.body[i], idx: i })
    else if (call.phase === 'teardown') teardowns.push({ node: p.body[i], idx: i })
    else tests.push({ node: p.body[i], idx: i })
  }
  return [...others, ...setups, ...teardowns, ...tests]
}
