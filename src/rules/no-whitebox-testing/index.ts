import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ImportDeclaration } from 'estree'

import {
  getArchitectureRuleListenerState,
  getArchitectureRuleState,
  isSamePath,
  matchFileToArchitectureModule,
  normalizeResolvedPath,
  resolveImportTarget,
} from '../../utils/index.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require tests to import a module through its public entrypoint',
      recommended: false,
    },
    schema: [],
    messages: {
      configurationError: 'Configuration error: {{details}}',
      usePublicEntrypoint:
        'White-box test import denied: tests must import this module through its public entrypoint (offending import: {{specifier}}).',
    },
  },
  create(context) {
    if (!isRecognizedTestFile(context.filename)) return {}

    const result = getArchitectureRuleListenerState(context)
    if ('listener' in result) return result.listener
    if (result.state.kind !== 'active') return {}
    const activeState = result.state

    return {
      ImportDeclaration(node) {
        checkImportDeclaration(context, node, activeState)
      },
    }
  },
} satisfies Rule.RuleModule

function checkImportDeclaration(
  context: Rule.RuleContext,
  node: ImportDeclaration,
  state: RuleState,
): void {
  const resolvedImport = resolveImport(node, state)
  if (resolvedImport === undefined) return
  if (resolvedImport.targetModule.ownerPath !== state.moduleMatch.ownerPath) return
  if (!isSameDirectoryImport(state.filename, resolvedImport.targetFile)) return
  if (isAllowedModuleEntrypoint(resolvedImport.targetFile, state.moduleMatch.policy.entrypoints))
    return

  context.report({
    node,
    messageId: 'usePublicEntrypoint',
    data: { specifier: resolvedImport.specifier },
  })
}

function resolveImport(node: ImportDeclaration, state: RuleState): ResolvedImport | undefined {
  const value = node.source.value
  if (typeof value !== 'string') return undefined

  const resolvedTarget = resolveImportTarget(state.filename, state.policy.projectContext, value)
  if (resolvedTarget === undefined) return undefined

  const targetFile = normalizeResolvedPath(resolvedTarget)
  const targetModule = matchFileToArchitectureModule(targetFile, state.policy)
  if (targetModule === undefined) return undefined

  return { specifier: value, targetFile, targetModule }
}

function isRecognizedTestFile(filename: string): boolean {
  if (filename.length === 0) return false
  return /\.(test|spec|[a-z]+-test|[a-z]+-spec)\.[^.]+$/.test(node_path.basename(filename))
}

function isSameDirectoryImport(importerFile: string, targetFile: string): boolean {
  return isSamePath(node_path.dirname(importerFile), node_path.dirname(targetFile))
}

function isAllowedModuleEntrypoint(targetFile: string, entrypoints: string[]): boolean {
  return entrypoints.includes(node_path.basename(targetFile))
}

interface ResolvedImport {
  specifier: string
  targetFile: string
  targetModule: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
}

type RuleState = Extract<ReturnType<typeof getArchitectureRuleState>, { kind: 'active' }>
