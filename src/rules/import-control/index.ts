import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import node_path from 'node:path'

import {
  createConfigurationErrorListeners,
  formatProjectContextError,
  getArchitectureRuleState,
  getRelativePath,
  isInsidePath,
  isSamePath,
  matchFileToArchitectureModule,
  normalizeResolvedPath,
  resolveImportTarget,
} from '../../utils/index.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce module import boundaries and configured entrypoint imports',
      recommended: false,
    },
    schema: [],
    messages: {
      configurationError: 'Configuration error: {{details}}',
      notAllowed: 'Import denied: module {{from}} cannot import module {{to}}.',
      nonEntrypoint:
        'Import denied: cross-module imports must target a configured module entrypoint (offending import: {{specifier}}).',
      namespaceLocalForbidden:
        'Import denied: local cross-module namespace imports are not allowed.',
      tooDeep: 'Import denied: same-module imports can only go one level deeper.',
    },
  },
  create(context) {
    const state = getArchitectureRuleState(context)
    if (state.kind === 'context-error') {
      return createConfigurationErrorListeners(context, formatProjectContextError(state.error))
    }

    if (state.kind !== 'active') return {}

    return {
      ImportDeclaration(node) {
        checkDeclaration(context, node, state)
      },
      ExportNamedDeclaration(node) {
        checkDeclaration(context, node, state)
      },
      ExportAllDeclaration(node) {
        checkDeclaration(context, node, state)
      },
    }
  },
} satisfies Rule.RuleModule

function checkDeclaration(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  state: RuleState,
): void {
  const edge = resolveDeclarationEdge(node, state)
  if (edge === undefined) return

  checkModuleEdge({
    context,
    ...edge,
  })
}

function resolveDeclarationEdge(
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  state: RuleState,
): DeclarationEdge | undefined {
  const specifier = getSpecifier(node)
  if (specifier === undefined) return undefined

  const resolvedTarget = resolveImportTarget(state.filename, state.policy.projectContext, specifier)
  if (resolvedTarget === undefined) return undefined

  const targetFile = normalizeResolvedPath(resolvedTarget)
  const importee = matchFileToArchitectureModule(targetFile, state.policy)
  if (importee === undefined) return undefined

  return {
    node,
    specifier,
    importerFile: state.filename,
    importer: state.moduleMatch,
    importee,
    targetFile,
  }
}

function getSpecifier(
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
): string | undefined {
  const source = node.source
  if (source == null) return undefined
  return typeof source.value === 'string' ? source.value : undefined
}

function checkModuleEdge(options: EdgeCheckOptions): void {
  const { context, node, specifier, importer, importee, targetFile, importerFile } = options
  if (importer.instance === importee.instance) {
    reportDeepSameModuleImport(context, node, importerFile, targetFile)
    return
  }

  if (isLocalNamespaceImport(node)) {
    context.report({ node, messageId: 'namespaceLocalForbidden' })
    return
  }

  if (isShallowRelativeEntrypoint(specifier, targetFile, importee.policy)) return

  if (!allowsImport(importer.policy, importee.matcher)) {
    context.report({
      node,
      messageId: 'notAllowed',
      data: { from: importer.matcher, to: importee.matcher },
    })
    return
  }

  if (isAllowedModuleEntrypoint(targetFile, importee.policy)) return
  context.report({
    node,
    messageId: 'nonEntrypoint',
    data: { specifier },
  })
}

function isLocalNamespaceImport(
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
): boolean {
  if (node.type !== 'ImportDeclaration') return false
  return node.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')
}

function isShallowRelativeEntrypoint(
  specifier: string,
  targetFile: string,
  policy: { entrypoints: string[] },
): boolean {
  return (
    !isRelativeTooDeep(specifier) &&
    specifier.startsWith('./') &&
    isAllowedModuleEntrypoint(targetFile, policy)
  )
}

function isAllowedModuleEntrypoint(targetFile: string, policy: { entrypoints: string[] }): boolean {
  return policy.entrypoints.includes(node_path.basename(targetFile))
}

interface EdgeCheckOptions {
  context: Rule.RuleContext
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration
  specifier: string
  importerFile: string
  importer: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  importee: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  targetFile: string
}

interface DeclarationEdge {
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration
  specifier: string
  importerFile: string
  importer: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  importee: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  targetFile: string
}

type RuleState = Extract<ReturnType<typeof getArchitectureRuleState>, { kind: 'active' }>

function reportDeepSameModuleImport(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  importerFile: string,
  targetFile: string,
): void {
  if (!isSameModuleImportTooDeep(importerFile, targetFile)) return
  context.report({ node, messageId: 'tooDeep' })
}

function isSameModuleImportTooDeep(importerFile: string, targetFile: string): boolean {
  if (isSamePath(importerFile, targetFile)) return false
  const importerDir = node_path.dirname(importerFile)
  if (!isInsidePath(importerDir, targetFile)) return false
  const relativeTarget = getRelativePath(importerDir, targetFile)
  return isForwardTraversalTooDeep(relativeTarget)
}

function isForwardTraversalTooDeep(relativeTarget: string): boolean {
  const segments = relativeTarget.split('/').filter(Boolean)
  if (segments.length === 0) return false
  if (segments[0] === '..') return false
  const depth = Math.max(segments.length - 1, 0)
  return depth > 1
}

function isRelativeTooDeep(specifier: string): boolean {
  if (!specifier.startsWith('./')) return false
  const parts = specifier.slice(2).split('/').filter(Boolean)
  const depth = Math.max(parts.length - 1, 0)
  return depth > 1
}

function allowsImport(policy: { imports: string[] }, targetMatcher: string): boolean {
  if (policy.imports.includes('*')) return true
  return policy.imports.some((pattern) => importPatternMatches(pattern, targetMatcher))
}

function importPatternMatches(pattern: string, target: string): boolean {
  const patternSegs = pattern.split('/').filter(Boolean)
  const targetSegs = target.split('/').filter(Boolean)
  if (patternSegs.length !== targetSegs.length) return false
  return patternSegs.every((seg, i) => seg === '*' || seg === targetSegs[i])
}
