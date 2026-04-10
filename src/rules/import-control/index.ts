import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import node_path from 'node:path'

import {
  getArchitectureRuleState,
  getRelativePath,
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  normalizeResolvedPath,
  resolveImportTarget,
} from '../../utils/index.js'

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce module import boundaries and public entrypoint imports',
      recommended: false,
    },
    schema: [],
    messages: {
      notAllowed: 'Import denied: module {{from}} cannot import module {{to}}.',
      nonEntrypoint: 'Import denied: cross-module imports must target index.ts or types.ts.',
      namespaceLocalForbidden:
        'Import denied: local cross-module namespace imports are not allowed.',
      tooDeep: 'Import denied: same-module imports can only go one level deeper.',
    },
  },
  create(context) {
    const state = getArchitectureRuleState(context)
    if (state === undefined) return {}

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

  if (isShallowRelativeEntrypoint(specifier, targetFile)) return

  if (!allowsImport(importer.policy, importee.matcher)) {
    context.report({
      node,
      messageId: 'notAllowed',
      data: { from: importer.matcher, to: importee.matcher },
    })
    return
  }

  if (isPublicEntrypoint(targetFile)) return
  context.report({ node, messageId: 'nonEntrypoint' })
}

function isLocalNamespaceImport(
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
): boolean {
  if (node.type !== 'ImportDeclaration') return false
  return node.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')
}

function isShallowRelativeEntrypoint(specifier: string, targetFile: string): boolean {
  return (
    !isRelativeTooDeep(specifier) && specifier.startsWith('./') && isPublicEntrypoint(targetFile)
  )
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

type RuleState = NonNullable<ReturnType<typeof getArchitectureRuleState>>

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
  const importerDir = node_path.dirname(importerFile)
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
  return policy.imports.includes('*') || policy.imports.includes(targetMatcher)
}
