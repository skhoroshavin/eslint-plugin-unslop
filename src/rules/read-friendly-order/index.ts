/* eslint-disable no-restricted-syntax, complexity, max-params */
import type { Rule } from 'eslint'

import type { Node, Program } from 'estree'

import {
  getDeclName,
  collectDeps,
  isEagerInit,
  isReexportNode,
  isLocalExportList,
  isLocalExportDefault,
  isLocalPublicExport,
  getDeclKind,
} from './ast-utils.js'

import { checkClass } from './class-order.js'

import { checkTestPhases } from './test-phase.js'

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce a read-friendly declaration order',
      recommended: true,
    },
    fixable: 'code',
    schema: [],
    messages: {
      moveHelperBelow: 'Move helper "{{name}}" below its first consumer.',
      moveConstantBelow: 'Move constant "{{name}}" below its first consumer.',
      constructorFirst: 'Constructor should be the first class member.',
      publicFieldOrder: 'Public fields should come right after the constructor.',
      moveMemberBelow: 'Move member "{{name}}" below its first consumer.',
      setupBeforeTeardown: 'Setup hooks should come before teardown hooks.',
      setupBeforeTests: 'Setup hooks should come before test calls.',
    },
  },
  create(context) {
    return {
      Program(pgm) {
        const p = pgm as unknown as Program & Rule.NodeParentExtension
        checkTestPhases(context, p)
        checkTopLevel(context, p)
      },
      ClassBody(node) {
        checkClass(context, node as unknown as Node & Rule.NodeParentExtension)
      },
    }
  },
} satisfies Rule.RuleModule

function checkTopLevel(ctx: Rule.RuleContext, p: Program & Rule.NodeParentExtension): void {
  const entries = collectEntries(p)

  // Filter to declarations (not imports or external re-exports)
  const decls = entries.filter((e) => !e.isImport && !e.isExternalReexport)
  filterDepsToLocal(decls)
  const eager = buildEagerSet(decls)
  const cyclic = findCyclic(decls)
  const violations = findViolations(decls, eager, cyclic)
  if (violations.length === 0) return
  reportAll(ctx, violations, p, entries)
}

function collectEntries(p: Program): Entry[] {
  const entries: Entry[] = []
  for (let i = 0; i < p.body.length; i++) {
    const stmt = p.body[i] as Node & Rule.NodeParentExtension
    const name = getDeclName(stmt)
    const isExternalReexport = isReexportNode(stmt)
    const isLocalExport = isLocalExportList(stmt)
    const isExportDefault = isLocalExportDefault(stmt)
    const isPublicExport = isLocalPublicExport(stmt)

    entries.push({
      node: stmt,
      idx: i,
      name,
      deps: collectDeps(stmt, name),
      eager: isEagerInit(stmt),
      isImport: stmt.type === 'ImportDeclaration',
      isExternalReexport: isExternalReexport,
      isLocalExportList: isLocalExport,
      isLocalExportDefault: isExportDefault,
      isLocalPublicExport: isPublicExport,
    })
  }
  return entries
}

function buildEagerSet(entries: Entry[]): Set<string> {
  const localNames = new Set(entries.filter((e) => e.name).map((e) => e.name!))
  const result = new Set<string>()
  for (const e of entries) {
    if (!e.eager) continue
    for (const d of e.deps) {
      if (localNames.has(d)) result.add(d)
    }
  }
  expandTransitive(entries, localNames, result)
  return result
}

function expandTransitive(entries: Entry[], localNames: Set<string>, result: Set<string>): void {
  let changed = true
  while (changed) {
    changed = false
    for (const e of entries) {
      if (!e.name || !result.has(e.name)) continue
      for (const d of e.deps) {
        if (localNames.has(d) && !result.has(d)) {
          result.add(d)
          changed = true
        }
      }
    }
  }
}

function findCyclic(entries: Entry[]): Set<string> {
  const byName = new Map(entries.filter((e) => e.name).map((e) => [e.name!, e]))
  const localNames = new Set(byName.keys())
  const inCycle = new Set<string>()
  for (const [name] of byName) {
    if (reachesSelf(name, name, byName, localNames, new Set())) {
      inCycle.add(name)
    }
  }
  return inCycle
}

function reachesSelf(
  target: string,
  current: string,
  byName: Map<string, Entry>,
  localNames: Set<string>,
  visited: Set<string>,
): boolean {
  return doReachesSelf({ target, current, byName, localNames, visited })
}

function doReachesSelf(args: ReachArgs): boolean {
  const entry = args.byName.get(args.current)
  if (!entry) return false
  for (const dep of entry.deps) {
    if (!args.localNames.has(dep)) continue
    if (dep === args.target) return true
    if (args.visited.has(dep)) continue
    args.visited.add(dep)
    if (doReachesSelf({ ...args, current: dep })) return true
  }
  return false
}

interface ReachArgs {
  target: string
  current: string
  byName: Map<string, Entry>
  localNames: Set<string>
  visited: Set<string>
}

function filterDepsToLocal(decls: Entry[]): void {
  const localNames = new Set(decls.filter((e) => e.name).map((e) => e.name!))
  for (const e of decls) {
    e.deps = new Set([...e.deps].filter((d) => localNames.has(d)))
  }
}

function findViolations(decls: Entry[], eager: Set<string>, cyclic: Set<string>): Entry[] {
  const violations: Entry[] = []
  for (const e of decls) {
    if (!e.name || eager.has(e.name) || cyclic.has(e.name)) continue
    const consumer = firstConsumer(e.name, decls)
    if (!consumer) continue
    // Check if this is a real violation:
    // 1. Declaration comes before consumer in source (e.idx < consumer.idx)
    // 2. AND declaration is in same or lower band than consumer
    //    (if declaration is in higher band, it's correct for it to come first)
    const eBand = getBand(e)
    const consumerBand = getBand(consumer)
    if (e.idx < consumer.idx && eBand >= consumerBand) {
      violations.push(e)
    }
  }
  return violations
}

function getBand(entry: Entry): number {
  if (entry.isImport) return 1
  if (entry.isExternalReexport) return 2
  if (entry.isLocalExportList || entry.isLocalExportDefault || entry.isLocalPublicExport) return 3
  return 4 // private declarations
}

function firstConsumer(name: string, decls: Entry[]): Entry | undefined {
  let best: Entry | undefined
  for (const e of decls) {
    if (e.name === name || e.isExternalReexport || e.isLocalExportList) continue
    if (!e.deps.has(name)) continue
    if (!best || e.idx < best.idx) best = e
  }
  return best
}

function reportAll(
  ctx: Rule.RuleContext,
  violations: Entry[],
  p: Program & Rule.NodeParentExtension,
  entries: Entry[],
): void {
  doReportAll({ ctx, violations, p, entries })
}

function doReportAll(args: ReportAllArgs): void {
  for (let i = 0; i < args.violations.length; i++) {
    const v = args.violations[i]
    args.ctx.report({
      node: v.node,
      messageId: isConst(v.name!) ? 'moveConstantBelow' : 'moveHelperBelow',
      data: { name: v.name! },
      fix: i === 0 ? buildTopFix(args.ctx, args.p, args.entries) : null,
    })
  }
}

interface ReportAllArgs {
  ctx: Rule.RuleContext
  violations: Entry[]
  p: Program & Rule.NodeParentExtension
  entries: Entry[]
}

function isConst(name: string): boolean {
  return /^[A-Z][A-Z_0-9]+$/.test(name)
}

function buildTopFix(
  ctx: Rule.RuleContext,
  p: Program & Rule.NodeParentExtension,
  entries: Entry[],
): (fixer: Rule.RuleFixer) => Rule.Fix {
  return (fixer) => {
    const src = ctx.sourceCode
    const nodeTexts = buildNodeTexts(src, entries)

    // Band 1: imports
    const imports = entries.filter((e) => e.isImport)

    // Band 2: external re-exports (export ... from ...)
    const externalReexports = entries.filter((e) => e.isExternalReexport)

    // Band 3: local public API (local export declarations, lists, and default)
    const localPublicApi = entries.filter(
      (e) => e.isLocalExportList || e.isLocalExportDefault || e.isLocalPublicExport,
    )
    const sortedPublicApi = kahnsSort(localPublicApi)

    // Prioritize export default at the top of local public API band if present
    const exportDefaultEntry = sortedPublicApi.find((e) => e.isLocalExportDefault)
    const otherPublicApi = sortedPublicApi.filter((e) => !e.isLocalExportDefault)
    const prioritizedPublicApi = exportDefaultEntry
      ? [exportDefaultEntry, ...otherPublicApi]
      : otherPublicApi

    // Band 4: private declarations (not imports, external re-exports, or local public API)
    const privateDecls = entries.filter(
      (e) =>
        !e.isImport &&
        !e.isExternalReexport &&
        !e.isLocalExportList &&
        !e.isLocalExportDefault &&
        !e.isLocalPublicExport,
    )
    const sortedPrivate = kahnsSort(privateDecls)

    // Combine all bands in canonical order
    const all = [...imports, ...externalReexports, ...prioritizedPublicApi, ...sortedPrivate]
    const text = all.map((e) => nodeTexts.get(e)).join('\n\n')
    return fixer.replaceTextRange([p.range![0], p.range![1]], text)
  }
}

function buildNodeTexts(src: Rule.RuleContext['sourceCode'], entries: Entry[]): Map<Entry, string> {
  const result = new Map<Entry, string>()
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const comments = src.getCommentsBefore(e.node)
    const prevEnd = i > 0 ? entries[i - 1].node.range![1] : e.node.range![0]
    const leadingComments = comments.filter((c) => c.range![0] >= prevEnd)
    if (leadingComments.length > 0) {
      const commentStart = leadingComments[0].range![0]
      const fullText = src.getText().slice(commentStart, e.node.range![1])
      result.set(e, fullText)
    } else {
      result.set(e, src.getText(e.node))
    }
  }
  return result
}

function kahnsSort(decls: Entry[]): Entry[] {
  const byName = new Map(decls.filter((e) => e.name).map((e) => [e.name!, e]))
  const inDeg = buildInDegrees(decls, byName)
  return drainKahns(decls, inDeg, byName)
}

function buildInDegrees(decls: Entry[], byName: Map<string, Entry>): Map<string, number> {
  const inDeg = new Map<string, number>()
  for (const [name] of byName) inDeg.set(name, 0)
  for (const e of decls) {
    for (const d of e.deps) {
      if (inDeg.has(d)) inDeg.set(d, inDeg.get(d)! + 1)
    }
  }
  return inDeg
}

function drainKahns(
  decls: Entry[],
  inDeg: Map<string, number>,
  byName: Map<string, Entry>,
): Entry[] {
  const queue = decls.filter((e) => !e.name || inDeg.get(e.name) === 0)
  const result: Entry[] = []
  const placed = new Set<string>()

  // Priority: constants (0) < types (1) < functions (2) < other (3)
  const kindPriority = (e: Entry): number => {
    const kind = getDeclKind(e.node as unknown as import('estree').Node)
    switch (kind) {
      case 'constant':
        return 0
      case 'type':
        return 1
      case 'function':
        return 2
      default:
        return 3
    }
  }

  while (queue.length > 0) {
    // Sort by: 1) kind priority (constants first), 2) original index
    queue.sort((a, b) => {
      const priorityDiff = kindPriority(a) - kindPriority(b)
      if (priorityDiff !== 0) return priorityDiff
      return a.idx - b.idx
    })
    const e = queue.shift()!
    result.push(e)
    if (e.name) placed.add(e.name)
    for (const d of e.deps) {
      if (placed.has(d) || !inDeg.has(d)) continue
      inDeg.set(d, inDeg.get(d)! - 1)
      if (inDeg.get(d) === 0) {
        const de = byName.get(d)
        if (de && !placed.has(d)) queue.push(de)
      }
    }
  }
  for (const e of decls) {
    if (e.name && !placed.has(e.name)) result.push(e)
  }
  return result
}

interface Entry {
  node: Node & Rule.NodeParentExtension
  idx: number
  name: string | null
  deps: Set<string>
  eager: boolean
  isImport: boolean
  isExternalReexport: boolean
  isLocalExportList: boolean
  isLocalExportDefault: boolean
  isLocalPublicExport: boolean
}
