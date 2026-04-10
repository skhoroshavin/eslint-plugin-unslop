import type { Rule } from 'eslint'

import type { Node, Program } from 'estree'

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
  return getPhaseFromExpression(stmt)
}

function getPhaseFromExpression(stmt: Node): Phase | null {
  const expr = Reflect.get(stmt, 'expression')
  if (!expr || typeof expr !== 'object') return null
  if (Reflect.get(expr, 'type') !== 'CallExpression') return null
  return getPhaseFromCallee(Reflect.get(expr, 'callee'))
}

function getPhaseFromCallee(callee: unknown): Phase | null {
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

const SETUP = new Set(['beforeAll', 'beforeEach'])

const TEARDOWN = new Set(['afterAll', 'afterEach'])

const TESTS = new Set(['test', 'it', 'describe'])

function buildPhaseFix(
  ctx: Rule.RuleContext,
  p: Program,
  calls: PhaseCall[],
): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const ordered = buildPhaseOrder(p, calls)
    const text = ordered.map((o) => ctx.sourceCode.getText(o.node)).join('\n\n')
    return fixer.replaceTextRange([p.range![0], p.range![1]], text)
  }
}

function buildPhaseOrder(p: Program, calls: PhaseCall[]): Array<{ node: Node; idx: number }> {
  const others: Array<{ node: Node; idx: number }> = []
  const setups: Array<{ node: Node; idx: number }> = []
  const teardowns: Array<{ node: Node; idx: number }> = []
  const tests: Array<{ node: Node; idx: number }> = []
  for (let i = 0; i < p.body.length; i++) {
    const call = calls.find((c) => c.idx === i)
    if (!call) others.push({ node: p.body[i], idx: i })
    else if (call.phase === 'setup') setups.push({ node: p.body[i], idx: i })
    else if (call.phase === 'teardown') teardowns.push({ node: p.body[i], idx: i })
    else tests.push({ node: p.body[i], idx: i })
  }
  return [...others, ...setups, ...teardowns, ...tests]
}

interface PhaseCall {
  node: Node
  phase: Phase
  idx: number
}

type Phase = 'setup' | 'teardown' | 'test'
