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

import { findCyclicNodes, kahnSort } from './graph-utils.js'

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
      publicApiAbovePrivate: 'Move public API declarations above private symbols.',
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
        checkTestPhases(context, pgm)
        analyzer.analyzeProgram(pgm)
      },
      ClassBody(node) {
        checkClass(context, node)
      },
    }
  },
} satisfies Rule.RuleModule

class TopLevelOrderAnalyzer {
  constructor(private readonly context: Rule.RuleContext) {}

  analyzeProgram(program: Program): void {
    const entries = this.collectEntries(program)
    const declarations = entries.filter(isDeclarationEntry)
    const byName = collectNamedEntryMap(declarations)
    const localNames: Set<string> = new Set(byName.keys())
    this.filterDepsToLocal(declarations, localNames)
    const eager = this.buildEagerSet(declarations, localNames)
    const cyclic = findCyclicNodes(
      declarations.filter((entry): entry is Entry & { name: string } => entry.name !== null),
    )
    const violations = this.findViolations(declarations, eager, cyclic)
    if (violations.length === 0) return
    this.reportAll(violations, program, entries)
  }

  private collectEntries(program: Program): Entry[] {
    const entries: Entry[] = []
    for (let index = 0; index < program.body.length; index++) {
      const statement = program.body[index]
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

  private findViolations(
    declarations: Entry[],
    eager: Set<string>,
    cyclic: Set<string>,
  ): Violation[] {
    const violations = this.findDependencyViolations(declarations, eager, cyclic)
    if (violations.length > 0 || cyclic.size > 0) return violations
    const seen = new Set(violations.map((violation) => violation.entry.idx))
    for (const violation of this.findBandViolations(declarations, eager, cyclic)) {
      if (seen.has(violation.entry.idx)) continue
      seen.add(violation.entry.idx)
      violations.push(violation)
    }
    return violations
  }

  private findDependencyViolations(
    declarations: Entry[],
    eager: Set<string>,
    cyclic: Set<string>,
  ): Violation[] {
    const violations: Violation[] = []
    for (const entry of declarations) {
      if (!entry.name || eager.has(entry.name) || cyclic.has(entry.name)) continue
      const consumer = firstConsumer(entry.name, declarations)
      if (!consumer) continue
      if (entry.idx < consumer.idx && getBand(entry) >= getBand(consumer)) {
        violations.push({ entry, messageId: getDependencyMessageId(entry.name) })
      }
    }
    return violations
  }

  private findBandViolations(
    declarations: Entry[],
    eager: Set<string>,
    cyclic: Set<string>,
  ): Violation[] {
    const violations: Violation[] = []
    let hasPrivateEntry = false
    for (const entry of declarations) {
      if (isPrivateEntry(entry)) {
        hasPrivateEntry = true
        continue
      }
      if (!entry.isLocalPublicExport || !hasPrivateEntry) continue
      if (entry.name !== null && (eager.has(entry.name) || cyclic.has(entry.name))) continue
      violations.push({ entry, messageId: 'publicApiAbovePrivate' })
    }
    return violations
  }

  private reportAll(violations: Violation[], program: Program, entries: Entry[]): void {
    const fix = this.buildTopFix(program, entries)
    for (let index = 0; index < violations.length; index++) {
      const violation = violations[index]
      this.context.report({
        node: violation.entry.node,
        messageId: violation.messageId,
        data:
          violation.messageId === 'publicApiAbovePrivate'
            ? undefined
            : { name: violation.entry.name! },
        fix: index === 0 ? fix : null,
      })
    }
  }

  private buildTopFix(program: Program, entries: Entry[]): (fixer: Rule.RuleFixer) => Rule.Fix {
    return (fixer) => {
      const source = this.context.sourceCode
      const nodeTexts = this.buildNodeTexts(source, entries)
      const ordered = buildCanonicalOrder(entries)
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

interface Violation {
  entry: Entry
  messageId: 'moveHelperBelow' | 'moveConstantBelow' | 'publicApiAbovePrivate'
}

function buildCanonicalOrder(entries: Entry[]): Entry[] {
  const compare = (a: Entry, b: Entry): number => {
    const priorityDiff = kindPriority(a) - kindPriority(b)
    if (priorityDiff !== 0) return priorityDiff
    return a.idx - b.idx
  }
  return [
    ...entries.filter(isImportEntry),
    ...entries.filter(isExternalReexportEntry),
    ...prioritizeDefaultExport(kahnSort(entries.filter(isLocalPublicApiEntry), compare)),
    ...kahnSort(entries.filter(isPrivateEntry), compare),
  ]
}

function prioritizeDefaultExport(entries: Entry[]): Entry[] {
  const exportDefaultEntry = entries.find((entry) => entry.isLocalExportDefault)
  if (exportDefaultEntry === undefined) return entries
  return [exportDefaultEntry, ...entries.filter((entry) => entry !== exportDefaultEntry)]
}

function collectNamedEntryMap(entries: Entry[]): Map<string, Entry> {
  const byName = new Map<string, Entry>()
  for (const entry of entries) {
    if (entry.name === null) continue
    byName.set(entry.name, entry)
  }
  return byName
}

function getBand(entry: Entry): number {
  if (entry.isImport) return BAND_IMPORT
  if (entry.isExternalReexport) return BAND_EXTERNAL_REEXPORT
  if (isLocalPublicApiEntry(entry)) return BAND_LOCAL_PUBLIC_API
  return BAND_PRIVATE
}

const BAND_IMPORT = 1

const BAND_EXTERNAL_REEXPORT = 2

const BAND_LOCAL_PUBLIC_API = 3

const BAND_PRIVATE = 4

function isDeclarationEntry(entry: Entry): boolean {
  return !entry.isImport && !entry.isExternalReexport
}

function isImportEntry(entry: Entry): boolean {
  return entry.isImport
}

function isExternalReexportEntry(entry: Entry): boolean {
  return entry.isExternalReexport
}

function isPrivateEntry(entry: Entry): boolean {
  return !entry.isImport && !entry.isExternalReexport && !isLocalPublicApiEntry(entry)
}

function isLocalPublicApiEntry(entry: Entry): boolean {
  return entry.isLocalExportList || entry.isLocalExportDefault || entry.isLocalPublicExport
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

function kindPriority(entry: Entry): number {
  const kind = getDeclKind(entry.node)
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

function getDependencyMessageId(name: string): 'moveHelperBelow' | 'moveConstantBelow' {
  return isConst(name) ? 'moveConstantBelow' : 'moveHelperBelow'
}

function isConst(name: string): boolean {
  return /^[A-Z][A-Z_0-9]+$/.test(name)
}
