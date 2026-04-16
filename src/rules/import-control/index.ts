import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import node_path from 'node:path'

import {
  getArchitectureRuleListenerState,
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
    const state = getArchitectureRuleListenerState(context)
    if (state.kind === 'listener') return state.listener
    if (state.state.kind !== 'active') return {}
    const activeState = state.state

    return {
      ImportDeclaration(node) {
        checkDeclaration(context, node, activeState)
      },
      ExportNamedDeclaration(node) {
        checkDeclaration(context, node, activeState)
      },
      ExportAllDeclaration(node) {
        checkDeclaration(context, node, activeState)
      },
    }
  },
} satisfies Rule.RuleModule

function checkDeclaration(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  state: RuleState,
): void {
  const specifier = getSpecifier(node)
  if (specifier === undefined) return

  const resolvedTarget = resolveImportTarget(state.filename, state.policy.projectContext, specifier)
  if (resolvedTarget === undefined) return

  const targetFile = normalizeResolvedPath(resolvedTarget)
  const importee = matchFileToArchitectureModule(targetFile, state.policy)
  if (importee === undefined) return

  checkModuleEdge({
    context,
    node,
    specifier,
    importerFile: state.filename,
    importer: state.moduleMatch,
    importee,
    targetFile,
  })
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
  if (importer.ownerPath === importee.ownerPath) {
    reportDeepSameModuleImport(context, node, importerFile, targetFile)
    return
  }

  if (isLocalNamespaceImport(node)) {
    context.report({ node, messageId: 'namespaceLocalForbidden' })
    return
  }

  if (isShallowRelativeEntrypoint(specifier, targetFile, importee.policy)) return

  if (!allowsImport(importer.policy, importee.canonicalPath)) {
    context.report({
      node,
      messageId: 'notAllowed',
      data: { from: importer.canonicalPath, to: importee.canonicalPath },
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
    !isRelativeDepthTooDeep(specifier) &&
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
  return isRelativePathTooDeep(relativeTarget)
}

function isRelativePathTooDeep(relativePath: string): boolean {
  const segments = relativePath.split('/').filter(Boolean)
  if (segments.length === 0) return false
  if (segments[0] === '..') return false
  return segments.length > 2
}

function isRelativeDepthTooDeep(specifier: string): boolean {
  if (!specifier.startsWith('./')) return false
  const parts = specifier.slice(2).split('/').filter(Boolean)
  return parts.length > 2
}

function allowsImport(policy: { imports: string[] }, targetMatcher: string): boolean {
  if (policy.imports.includes('*')) return true
  return policy.imports.some((pattern) => importPatternMatches(pattern, targetMatcher))
}

function importPatternMatches(pattern: string, target: string): boolean {
  if (pattern === target) return true

  const plusBase = getTerminalWildcardBase(pattern, '+')
  if (plusBase !== undefined) {
    return isExactOrDirectChild(plusBase, target)
  }

  const starBase = getTerminalWildcardBase(pattern, '*')
  if (starBase !== undefined) {
    return isDirectChildModule(starBase, target)
  }

  return false
}

function getTerminalWildcardBase(pattern: string, wildcard: '*' | '+'): string | undefined {
  const suffix = `/${wildcard}`
  if (!pattern.endsWith(suffix)) return undefined
  const base = pattern.slice(0, -suffix.length)
  return base.length > 0 ? base : undefined
}

function isExactOrDirectChild(base: string, target: string): boolean {
  return target === base || isDirectChildModule(base, target)
}

function isDirectChildModule(base: string, target: string): boolean {
  const prefix = `${base}/`
  if (!target.startsWith(prefix)) return false
  const remainder = target.slice(prefix.length)
  return remainder.length > 0 && !remainder.includes('/')
}
