import type { Rule } from 'eslint'
import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'
import {
  allowsImport,
  isPublicEntrypoint,
  isRelativeTooDeep,
  matchFileToArchitectureModule,
  readArchitecturePolicy,
  resolveImportTarget,
} from '../../utils/index.js'

const rule: Rule.RuleModule = {
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
      tooDeep: 'Import denied: same-module relative imports can only go one level deeper.',
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
}

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

  const targetFile = getTargetFile(filename, policy.sourceRoot, specifier)
  if (targetFile === undefined) return

  const importee = getImportee(targetFile, policy)
  if (importee === undefined) return

  checkModuleEdge({ context, node, specifier, importer, importee, targetFile })
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
  sourceRoot: string | undefined,
  specifier: string,
): string | undefined {
  return resolveImportTarget(filename, sourceRoot, specifier)
}

function getImportee(
  targetFile: string,
  policy: NonNullable<ReturnType<typeof readArchitecturePolicy>>,
) {
  return matchFileToArchitectureModule(targetFile, policy)
}

function checkModuleEdge(options: EdgeCheckOptions): void {
  const { context, node, specifier, importer, importee, targetFile } = options
  if (importer.instance === importee.instance) {
    reportDeepRelativeImport(context, node, specifier)
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
  importer: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  importee: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  targetFile: string
}

function reportDeepRelativeImport(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  specifier: string,
): void {
  if (!isRelativeTooDeep(specifier)) return
  context.report({ node, messageId: 'tooDeep' })
}

export default rule
