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
    const analyzer = new TopLevelOrderAnalyzer(context)
    return {
      Program(pgm) {
        const p = pgm as unknown as Program & Rule.NodeParentExtension
        checkTestPhases(context, p)
        analyzer.analyzeProgram(p)
      },
      ClassBody(node) {
        checkClass(context, node as unknown as Node & Rule.NodeParentExtension)
      },
    }
  },
} satisfies Rule.RuleModule

class TopLevelOrderAnalyzer {
  constructor(private readonly context: Rule.RuleContext) {}

  analyzeProgram(program: Program & Rule.NodeParentExtension): void {
    const entries = this.collectEntries(program)
    const declarations = entries.filter(isDeclarationEntry)
    const namedDeclarations = collectNamedEntries(declarations)
    this.filterDepsToLocal(declarations, namedDeclarations.names)
    const eager = this.buildEagerSet(declarations, namedDeclarations.names)
    const cyclic = this.findCyclic(namedDeclarations)
    const violations = this.findViolations(declarations, eager, cyclic)
    if (violations.length === 0) return
    this.reportAll(violations, program, entries)
  }

  private collectEntries(program: Program): Entry[] {
    const entries: Entry[] = []
    for (let index = 0; index < program.body.length; index++) {
      const statement = program.body[index] as Node & Rule.NodeParentExtension
      const name = getDeclName(statement)
      entries.push({
        node: statement,
        idx: index,
        name,
        deps: collectDeps(statement, name),
        eager: isEagerInit(statement),
        isImport: statement.type === 'ImportDeclaration',
        isExternalReexport: isReexportNode(statement),
        isLocalExportList: isLocalExportList(statement),
        isLocalExportDefault: isLocalExportDefault(statement),
        isLocalPublicExport: isLocalPublicExport(statement),
      })
    }
    return entries
  }

  private filterDepsToLocal(declarations: Entry[], localNames: Set<string>): void {
    for (const entry of declarations) {
      entry.deps = new Set([...entry.deps].filter((dependency) => localNames.has(dependency)))
    }
  }

  private buildEagerSet(entries: Entry[], localNames: Set<string>): Set<string> {
    const eagerSymbols = new Set<string>()
    for (const entry of entries) {
      if (!entry.eager) continue
      for (const dependency of entry.deps) {
        if (localNames.has(dependency)) {
          eagerSymbols.add(dependency)
        }
      }
    }
    this.expandTransitiveEager(entries, localNames, eagerSymbols)
    return eagerSymbols
  }

  private expandTransitiveEager(
    entries: Entry[],
    localNames: Set<string>,
    eagerSymbols: Set<string>,
  ): void {
    let hasChanges = true
    while (hasChanges) {
      hasChanges = false
      for (const entry of entries) {
        if (!entry.name || !eagerSymbols.has(entry.name)) continue
        for (const dependency of entry.deps) {
          if (!localNames.has(dependency) || eagerSymbols.has(dependency)) continue
          eagerSymbols.add(dependency)
          hasChanges = true
        }
      }
    }
  }

  private findCyclic(namedEntries: NamedEntries): Set<string> {
    const cyclic = new Set<string>()
    for (const [name] of namedEntries.byName) {
      if (this.reachesSelf(name, name, namedEntries.byName, namedEntries.names, new Set())) {
        cyclic.add(name)
      }
    }
    return cyclic
  }

  private reachesSelf(
    target: string,
    current: string,
    byName: Map<string, Entry>,
    localNames: Set<string>,
    visited: Set<string>,
  ): boolean {
    const entry = byName.get(current)
    if (!entry) return false
    for (const dependency of entry.deps) {
      if (!localNames.has(dependency)) continue
      if (dependency === target) return true
      if (visited.has(dependency)) continue
      visited.add(dependency)
      if (this.reachesSelf(target, dependency, byName, localNames, visited)) {
        return true
      }
    }
    return false
  }

  private findViolations(declarations: Entry[], eager: Set<string>, cyclic: Set<string>): Entry[] {
    const violations: Entry[] = []
    for (const entry of declarations) {
      if (!entry.name || eager.has(entry.name) || cyclic.has(entry.name)) continue
      const consumer = firstConsumer(entry.name, declarations)
      if (!consumer) continue
      if (entry.idx < consumer.idx && getBand(entry) >= getBand(consumer)) {
        violations.push(entry)
      }
    }
    return violations
  }

  private reportAll(
    violations: Entry[],
    program: Program & Rule.NodeParentExtension,
    entries: Entry[],
  ): void {
    for (let index = 0; index < violations.length; index++) {
      const violation = violations[index]
      this.context.report({
        node: violation.node,
        messageId: isConst(violation.name!) ? 'moveConstantBelow' : 'moveHelperBelow',
        data: { name: violation.name! },
        fix: index === 0 ? this.buildTopFix(program, entries) : null,
      })
    }
  }

  private buildTopFix(
    program: Program & Rule.NodeParentExtension,
    entries: Entry[],
  ): (fixer: Rule.RuleFixer) => Rule.Fix {
    return (fixer) => {
      const source = this.context.sourceCode
      const nodeTexts = this.buildNodeTexts(source, entries)
      const imports = entries.filter((entry) => entry.isImport)
      const externalReexports = entries.filter((entry) => entry.isExternalReexport)
      const localPublicApi = entries.filter(isLocalPublicApiEntry)
      const sortedPublicApi = kahnsSort(localPublicApi)
      const exportDefaultEntry = sortedPublicApi.find((entry) => entry.isLocalExportDefault)
      const otherPublicApi = sortedPublicApi.filter((entry) => !entry.isLocalExportDefault)
      const prioritizedPublicApi = exportDefaultEntry
        ? [exportDefaultEntry, ...otherPublicApi]
        : otherPublicApi
      const privateDecls = entries.filter(isPrivateEntry)
      const sortedPrivate = kahnsSort(privateDecls)
      const ordered = [...imports, ...externalReexports, ...prioritizedPublicApi, ...sortedPrivate]
      const text = ordered.map((entry) => nodeTexts.get(entry)).join('\n\n')
      return fixer.replaceTextRange([program.range![0], program.range![1]], text)
    }
  }

  private buildNodeTexts(
    src: Rule.RuleContext['sourceCode'],
    entries: Entry[],
  ): Map<Entry, string> {
    const result = new Map<Entry, string>()
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]
      const comments = src.getCommentsBefore(entry.node)
      const prevEnd = index > 0 ? entries[index - 1].node.range![1] : entry.node.range![0]
      const leadingComments = comments.filter((comment) => comment.range![0] >= prevEnd)
      if (leadingComments.length > 0) {
        const commentStart = leadingComments[0].range![0]
        const fullText = src.getText().slice(commentStart, entry.node.range![1])
        result.set(entry, fullText)
        continue
      }
      result.set(entry, src.getText(entry.node))
    }
    return result
  }
}

interface NamedEntries {
  byName: Map<string, Entry>
  names: Set<string>
}

function collectNamedEntries(entries: Entry[]): NamedEntries {
  const byName = new Map<string, Entry>()
  for (const entry of entries) {
    if (entry.name === null) continue
    byName.set(entry.name, entry)
  }
  return { byName, names: new Set(byName.keys()) }
}

function getBand(entry: Entry): number {
  if (entry.isImport) return BAND_IMPORT
  if (entry.isExternalReexport) return BAND_EXTERNAL_REEXPORT
  if (isLocalPublicApiEntry(entry)) return BAND_LOCAL_PUBLIC_API
  return BAND_PRIVATE
}

function isDeclarationEntry(entry: Entry): boolean {
  return !entry.isImport && !entry.isExternalReexport
}

function isLocalPublicApiEntry(entry: Entry): boolean {
  return entry.isLocalExportList || entry.isLocalExportDefault || entry.isLocalPublicExport
}

function isPrivateEntry(entry: Entry): boolean {
  return !entry.isImport && !entry.isExternalReexport && !isLocalPublicApiEntry(entry)
}

const BAND_IMPORT = 1
const BAND_EXTERNAL_REEXPORT = 2
const BAND_LOCAL_PUBLIC_API = 3
const BAND_PRIVATE = 4

function firstConsumer(name: string, decls: Entry[]): Entry | undefined {
  let best: Entry | undefined
  for (const e of decls) {
    if (e.name === name || e.isExternalReexport || e.isLocalExportList) continue
    if (!e.deps.has(name)) continue
    if (!best || e.idx < best.idx) best = e
  }
  return best
}

function isConst(name: string): boolean {
  return /^[A-Z][A-Z_0-9]+$/.test(name)
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
