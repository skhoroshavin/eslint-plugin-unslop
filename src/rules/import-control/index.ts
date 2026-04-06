import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import node_path from 'node:path'

import { ArchitecturePolicyResolver, normalizePath } from '../../utils/index.js'

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
    const filename = context.filename
    if (!filename) return {}

    const resolver = ArchitecturePolicyResolver.fromContext(context)
    if (resolver === undefined) return {}

    return {
      ImportDeclaration(node) {
        checkDeclaration(context, node, filename, resolver)
      },
      ExportNamedDeclaration(node) {
        checkDeclaration(context, node, filename, resolver)
      },
      ExportAllDeclaration(node) {
        checkDeclaration(context, node, filename, resolver)
      },
    }
  },
} satisfies Rule.RuleModule

function checkDeclaration(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  filename: string,
  resolver: ArchitecturePolicyResolver,
): void {
  const specifier = getSpecifier(node)
  if (specifier === undefined) return

  const importer = getImporter(filename, resolver)
  if (importer === undefined) return

  const targetFile = getTargetFile(filename, resolver, specifier)
  if (targetFile === undefined) return

  const importee = getImportee(targetFile, resolver)
  if (importee === undefined) return

  checkModuleEdge({
    context,
    node,
    specifier,
    importerFile: filename,
    importer,
    importee,
    targetFile,
    resolver,
  })
}

function getSpecifier(
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
): string | undefined {
  const source = node.source
  if (source === undefined || source === null) return undefined
  return typeof source.value === 'string' ? source.value : undefined
}

function getImporter(filename: string, resolver: ArchitecturePolicyResolver) {
  return resolver.matchFile(filename)
}

function getTargetFile(
  filename: string,
  resolver: ArchitecturePolicyResolver,
  specifier: string,
): string | undefined {
  const resolved = resolver.resolveImportTarget(filename, specifier)
  return resolved === undefined ? undefined : normalizePath(resolved)
}

function getImportee(targetFile: string, resolver: ArchitecturePolicyResolver) {
  return resolver.matchFile(targetFile)
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

  if (isShallowRelativeEntrypoint(specifier, targetFile, options.resolver)) return

  if (!allowsImport(importer.policy, importee.matcher)) {
    context.report({
      node,
      messageId: 'notAllowed',
      data: { from: importer.matcher, to: importee.matcher },
    })
    return
  }

  if (options.resolver.isPublicEntrypoint(targetFile)) return
  context.report({ node, messageId: 'nonEntrypoint' })
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
  resolver: ArchitecturePolicyResolver,
): boolean {
  return (
    !isRelativeTooDeep(specifier) &&
    specifier.startsWith('./') &&
    resolver.isPublicEntrypoint(targetFile)
  )
}

interface EdgeCheckOptions {
  context: Rule.RuleContext
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration
  specifier: string
  importerFile: string
  importer: NonNullable<ReturnType<ArchitecturePolicyResolver['matchFile']>>
  importee: NonNullable<ReturnType<ArchitecturePolicyResolver['matchFile']>>
  targetFile: string
  resolver: ArchitecturePolicyResolver
}

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
  const importerDir = normalizePath(node_path.dirname(importerFile))
  const relativeTarget = normalizePath(node_path.relative(importerDir, targetFile))
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
