import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Rule } from 'eslint'
import { toPosix } from '../utils/path-helpers.js'
import { readSourceRootOption } from '../utils/rule-options.js'
import { resolveSourceContext } from '../utils/source-root.js'

const NO_DEEP_IMPORTS_SCHEMA = [
  {
    type: 'object',
    properties: {
      sourceRoot: { type: 'string' },
    },
    additionalProperties: false,
  },
]

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid deep imports inside the same top-level folder',
      recommended: true,
    },
    messages: {
      tooDeep:
        '{{sourceRelativePath}}: {{targetRelativePath}} is too deep (max 1 level below importer).',
    },
    schema: NO_DEEP_IMPORTS_SCHEMA,
  },
  create(context: Rule.RuleContext) {
    const filename = context.filename
    const sourceRootOption = readSourceRootOption(context.options)
    const sourceContext = resolveSourceContext(filename, sourceRootOption)
    if (!sourceContext) {
      return {}
    }

    const { sourceRelativePath, sourceRoot } = sourceContext

    return {
      ImportDeclaration(node) {
        const specifier = typeof node.source.value === 'string' ? node.source.value : ''

        const violation = findViolation(specifier, filename, sourceRoot, sourceRelativePath)

        if (violation) {
          context.report({
            node,
            messageId: 'tooDeep',
            data: violation,
          })
        }
      },
    }
  },
} satisfies Rule.RuleModule

function findViolation(
  specifier: string,
  filename: string,
  sourceRoot: string,
  sourceRelativePath: string,
): { sourceRelativePath: string; targetRelativePath: string } | undefined {
  const targetSourceRelative = resolveImportSourceRelative(specifier, filename, sourceRoot)
  if (!targetSourceRelative) {
    return undefined
  }

  const targetRelativePath = resolveTarget(targetSourceRelative, sourceRoot)
  if (!targetRelativePath) {
    return undefined
  }

  const folderScope = folderScopeFromPath(sourceRelativePath)
  if (!isInScope(targetRelativePath, folderScope)) {
    return undefined
  }

  const importerDepth = depthWithinScope(sourceRelativePath, folderScope)
  const targetDepth = depthWithinScope(targetRelativePath, folderScope)
  if (targetDepth <= importerDepth + 1) {
    return undefined
  }

  return {
    sourceRelativePath,
    targetRelativePath: stripTsExtension(targetRelativePath),
  }
}

function resolveImportSourceRelative(
  specifier: string,
  filename: string,
  sourceRoot: string,
): string | undefined {
  const normalizedSpecifier = specifier.replace(/\.(js|ts|tsx|jsx)$/, '')

  if (normalizedSpecifier.startsWith('@/')) {
    return normalizedSpecifier.slice(2)
  }

  if (!normalizedSpecifier.startsWith('.')) {
    return undefined
  }

  const absoluteTarget = path.resolve(path.dirname(filename), normalizedSpecifier)
  const targetSourceRelative = path.relative(sourceRoot, absoluteTarget)
  if (targetSourceRelative.startsWith('..')) {
    return undefined
  }

  return toPosix(targetSourceRelative)
}

function resolveTarget(targetSourceRelative: string, sourceRoot: string): string | undefined {
  const cacheKey = `${sourceRoot}\0${targetSourceRelative}`
  if (resolveCache.has(cacheKey)) {
    return resolveCache.get(cacheKey)
  }

  const candidates = [
    targetSourceRelative + '.ts',
    targetSourceRelative + '.tsx',
    targetSourceRelative + '/index.ts',
    targetSourceRelative + '/index.tsx',
  ]
  const candidate = candidates.find((entry) => existsSync(path.join(sourceRoot, entry)))
  const targetRelativePath = candidate ? toPosix(candidate) : undefined

  resolveCache.set(cacheKey, targetRelativePath)
  return targetRelativePath
}

function folderScopeFromPath(sourceRelativePath: string): string {
  const [firstPart = ''] = sourceRelativePath.split('/')
  return stripTsExtension(firstPart)
}

function isInScope(targetRelativePath: string, scope: string): boolean {
  const targetNoExtension = stripTsExtension(targetRelativePath)
  return targetNoExtension === scope || targetNoExtension.startsWith(`${scope}/`)
}

function depthWithinScope(relativePath: string, scope: string): number {
  const withoutExtension = stripTsExtension(relativePath)
  if (withoutExtension === scope) {
    return 0
  }

  // Precondition: isInScope() already confirmed target is within scope,
  // so withoutExtension always starts with scope + '/'
  const suffix = withoutExtension.slice(scope.length + 1)
  return suffix.split('/').length - 1
}

const resolveCache = new Map<string, string | undefined>()

function stripTsExtension(filePath: string): string {
  return filePath.replace(/\.tsx?$/, '')
}
