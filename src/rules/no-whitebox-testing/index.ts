import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ImportDeclaration } from 'estree'

import {
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
      usePublicEntrypoint:
        'White-box test import denied: tests must import this module through its public entrypoint (offending import: {{specifier}}).',
    },
  },
  create(context) {
    if (!isRecognizedTestFile(context.filename)) return {}

    const state = getArchitectureRuleState(context)
    if (state === undefined) return {}

    return {
      ImportDeclaration(node) {
        checkImportDeclaration(context, node, state)
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
  if (resolvedImport.targetModule.instance !== state.moduleMatch.instance) return
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
  const specifier = getSpecifier(node)
  if (specifier === undefined) return undefined

  const resolvedTarget = resolveImportTarget(state.filename, state.policy.projectContext, specifier)
  if (resolvedTarget === undefined) return undefined

  const targetFile = normalizeResolvedPath(resolvedTarget)
  const targetModule = matchFileToArchitectureModule(targetFile, state.policy)
  if (targetModule === undefined) return undefined

  return { specifier, targetFile, targetModule }
}

function getSpecifier(node: ImportDeclaration): string | undefined {
  const value = node.source.value
  return typeof value === 'string' ? value : undefined
}

function isRecognizedTestFile(filename: string): boolean {
  if (filename.length === 0) return false
  const basename = node_path.basename(filename)
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(basename))
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

type RuleState = NonNullable<ReturnType<typeof getArchitectureRuleState>>

const TEST_FILE_PATTERNS: RegExp[] = [
  /^.+\.test\..+$/,
  /^.+\.spec\..+$/,
  /^.+\.[^.]+-test\..+$/,
  /^.+\.[^.]+-spec\..+$/,
]
