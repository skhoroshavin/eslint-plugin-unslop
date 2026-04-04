import type { Rule } from 'eslint'
import type { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration } from 'estree'
import {
  allowsImport,
  isPublicEntrypoint,
  isRelativeTooDeep,
  matchFileToArchitectureModule,
  readArchitecturePolicy,
  resolveImportTarget,
} from '../../utils/architecture-policy.js'

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce module import boundaries and public entrypoint imports',
      recommended: false,
    },
    schema: [],
    messages: {
      missingArchitecture:
        'Import denied because {{side}} does not match settings.unslop.architecture.',
      notAllowed: 'Import denied: module {{from}} cannot import module {{to}}.',
      nonEntrypoint: 'Import denied: cross-module imports must target index.ts or types.ts.',
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

  const importer = getImporter(context, node, filename, policy)
  if (importer === undefined) {
    return
  }

  const targetFile = getTargetFile(filename, policy.sourceRoot, specifier)
  if (targetFile === undefined) return

  const importee = getImportee(context, node, targetFile, policy)
  if (importee === undefined) {
    return
  }

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
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  filename: string,
  policy: NonNullable<ReturnType<typeof readArchitecturePolicy>>,
) {
  const importer = matchFileToArchitectureModule(filename, policy)
  if (importer !== undefined) return importer
  reportMissingModule(context, node, 'importer')
  return undefined
}

function getTargetFile(
  filename: string,
  sourceRoot: string | undefined,
  specifier: string,
): string | undefined {
  return resolveImportTarget(filename, sourceRoot, specifier)
}

function getImportee(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  targetFile: string,
  policy: NonNullable<ReturnType<typeof readArchitecturePolicy>>,
) {
  const importee = matchFileToArchitectureModule(targetFile, policy)
  if (importee !== undefined) return importee
  reportMissingModule(context, node, 'importee')
  return undefined
}

function checkModuleEdge(options: EdgeCheckOptions): void {
  const { context, node, specifier, importer, importee, targetFile } = options
  if (importer.instance === importee.instance) {
    reportDeepRelativeImport(context, node, specifier)
    return
  }

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

interface EdgeCheckOptions {
  context: Rule.RuleContext
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration
  specifier: string
  importer: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  importee: NonNullable<ReturnType<typeof matchFileToArchitectureModule>>
  targetFile: string
}

function reportMissingModule(
  context: Rule.RuleContext,
  node: ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration,
  side: string,
): void {
  context.report({ node, messageId: 'missingArchitecture', data: { side } })
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
