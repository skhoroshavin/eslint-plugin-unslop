import node_path from 'node:path'

import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import { ArchitecturePolicyResolver, isPublicEntrypoint, normalizePath } from '../../utils/index.js'

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

  const importer = resolver.matchFile(filename)
  if (importer === undefined) return

  const resolvedTarget = resolver.context.resolveLocalSpecifier(filename, specifier)
  if (resolvedTarget === undefined) return
  const targetFile = normalizePath(resolvedTarget)

  const importee = resolver.matchFile(targetFile)
  if (importee === undefined) return

  checkModuleEdge({
    context,
    node,
    specifier,
    importerFile: filename,
    importer,
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
  if (options.importer.instance === options.importee.instance) {
    checkSameModuleEdge(options)
    return
  }

  checkCrossModuleEdge(options)
}

function checkSameModuleEdge(options: EdgeCheckOptions): void {
  const { context, importerFile, node, targetFile } = options
  if (isSameModuleImportTooDeep(importerFile, targetFile)) {
    context.report({ node, messageId: 'tooDeep' })
  }
}

function checkCrossModuleEdge(options: EdgeCheckOptions): void {
  const { context, node, specifier, importer, importee, targetFile } = options

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
  importer: NonNullable<ReturnType<ArchitecturePolicyResolver['matchFile']>>
  importee: NonNullable<ReturnType<ArchitecturePolicyResolver['matchFile']>>
  targetFile: string
}

function isSameModuleImportTooDeep(importerFile: string, targetFile: string): boolean {
  const importerDir = normalizePath(node_path.dirname(importerFile))
  const relativeTarget = normalizePath(node_path.relative(importerDir, targetFile))
  return isDeeperThanOneLevel(relativeTarget)
}

function isRelativeTooDeep(specifier: string): boolean {
  if (!specifier.startsWith('./')) return false
  return isDeeperThanOneLevel(specifier.slice(2))
}

function isDeeperThanOneLevel(pathValue: string): boolean {
  const segments = pathValue.split('/').filter(Boolean)
  if (segments.length === 0) return false
  if (segments[0] === '..') return false
  return segments.length > 2
}

function allowsImport(policy: { imports: string[] }, targetMatcher: string): boolean {
  return policy.imports.includes('*') || policy.imports.includes(targetMatcher)
}
