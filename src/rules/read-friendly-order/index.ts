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

import { findCyclicNames, kahnsTopologicalSort } from './kahns-sort.js'

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
        checkTestPhases(context, pgm)
        checkTopLevel(context, pgm)
      },
      ClassBody(node) {
        checkClass(context, node)
      },
    }
  },
} satisfies Rule.RuleModule

function checkTopLevel(ctx: Rule.RuleContext, p: Program): void {
  const entries = collectEntries(p)

  // Filter to declarations (not imports or external re-exports)
  const decls = entries.filter((e) => !e.isImport && !e.isExternalReexport)
  filterDepsToLocal(decls)
  const eager = buildEagerSet(decls)
  const cyclic = findCyclicNames(decls)
  const violations = findViolations(decls, eager, cyclic)
  if (violations.length === 0) return
  reportAll(ctx, violations, p, entries)
}

function collectEntries(p: Program): Entry[] {
  const entries: Entry[] = []
  for (let i = 0; i < p.body.length; i++) {
    entries.push(buildEntry(p.body[i], i))
  }
  return entries
}

function buildEntry(stmt: Node, idx: number): Entry {
  const name = getDeclName(stmt)
  return {
    node: stmt,
    idx,
    name,
    deps: collectDeps(stmt, name),
    eager: isEagerInit(stmt),
    isImport: stmt.type === 'ImportDeclaration',
    isExternalReexport: isReexportNode(stmt),
    isLocalExportList: isLocalExportList(stmt),
    isLocalExportDefault: isLocalExportDefault(stmt),
    isLocalPublicExport: isLocalPublicExport(stmt),
  }
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

function reportAll(ctx: Rule.RuleContext, violations: Entry[], p: Program, entries: Entry[]): void {
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
  p: Program
  entries: Entry[]
}

function isConst(name: string): boolean {
  return /^[A-Z][A-Z_0-9]+$/.test(name)
}

function buildTopFix(
  ctx: Rule.RuleContext,
  p: Program,
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
    const sortedPublicApi = kahnsTopologicalSort(localPublicApi, kindPriority)

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
    const sortedPrivate = kahnsTopologicalSort(privateDecls, kindPriority)

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

function kindPriority(e: Entry): number {
  const kind = getDeclKind(e.node)
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

interface Entry {
  node: Node
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
