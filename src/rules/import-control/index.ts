import type { Rule } from 'eslint'

import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'

import node_path from 'node:path'

import {
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  normalizePath,
  readArchitecturePolicy,
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
    const filename = context.filename
    if (!filename) return {}

    const policy = readArchitecturePolicy(context)
    if (policy === undefined) return {}

    return {
      ImportDeclaration(node) {
        checkDeclaration(context, node, filename, policy)
      },
      ExportNamedDeclaration(node) {
        checkDeclaration(context, node, filename, policy)
      },
      ExportAllDeclaration(node) {
        checkDeclaration(context, node, filename, policy)
      },
    }
  },
} satisfies Rule.RuleModule

function checkDeclaration(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  filename: string,
  policy: NonNullable<ReturnType<typeof readArchitecturePolicy>>,
): void {
  const specifier = getSpecifier(node)
  if (specifier === undefined) return

  const importer = getImporter(filename, policy)
  if (importer === undefined) return

  const targetFile = getTargetFile(filename, policy.tsconfigInfo, specifier)
  if (targetFile === undefined) return

  const importee = getImportee(targetFile, policy)
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
  if (source === undefined || source === null) return undefined
  return typeof source.value === 'string' ? source.value : undefined
}

function getImporter(
  filename: string,
  policy: NonNullable<ReturnType<typeof readArchitecturePolicy>>,
) {
  return matchFileToArchitectureModule(filename, policy)
}

function getTargetFile(
  filename: string,
  tsconfigInfo: NonNullable<ReturnType<typeof readArchitecturePolicy>>['tsconfigInfo'],
  specifier: string,
): string | undefined {
  const resolved = resolveImportTarget(filename, tsconfigInfo, specifier)
  return resolved === undefined ? undefined : normalizePath(resolved)
}

function getImportee(
  targetFile: string,
  policy: NonNullable<ReturnType<typeof readArchitecturePolicy>>,
) {
  return matchFileToArchitectureModule(targetFile, policy)
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
