import { existsSync } from 'node:fs'
import path from 'node:path'
import { isInsidePath, toPosix } from './path-helpers.js'

export function resolveSourceContext(
  filename: string,
  sourceRootOverride?: string,
): SourceContext | undefined {
  if (filename === '<input>') {
    return undefined
  }

  const absoluteFilename = path.isAbsolute(filename) ? filename : path.resolve(filename)

  if (sourceRootOverride) {
    const projectRoot = findNearestPackageRoot(path.dirname(absoluteFilename)) ?? process.cwd()
    return buildContext(
      absoluteFilename,
      projectRoot,
      path.isAbsolute(sourceRootOverride)
        ? sourceRootOverride
        : path.join(projectRoot, sourceRootOverride),
    )
  }

  const packageRoot = findNearestPackageRoot(path.dirname(absoluteFilename))
  if (packageRoot) {
    return buildContext(
      absoluteFilename,
      packageRoot,
      existsSync(path.join(packageRoot, 'src')) ? path.join(packageRoot, 'src') : packageRoot,
    )
  }

  return resolveLegacySourceRoot(absoluteFilename)
}

function findNearestPackageRoot(startDirectory: string): string | undefined {
  let directory = startDirectory

  while (true) {
    if (existsSync(path.join(directory, 'package.json'))) {
      return directory
    }

    const parent = path.dirname(directory)
    if (parent === directory) {
      return undefined
    }

    directory = parent
  }
}

function resolveLegacySourceRoot(filename: string): SourceContext | undefined {
  const normalized = toPosix(filename)
  const sourceIndex = normalized.lastIndexOf('/src/')
  if (sourceIndex === -1) {
    return undefined
  }

  const projectRoot = normalized.slice(0, sourceIndex)
  const sourceRoot = path.join(projectRoot, 'src')
  return buildContext(filename, projectRoot, sourceRoot)
}

function buildContext(
  filename: string,
  projectRoot: string,
  sourceRoot: string,
): SourceContext | undefined {
  if (!isInsidePath(filename, sourceRoot)) {
    return undefined
  }

  return {
    projectRoot,
    sourceRoot,
    sourceRelativePath: toPosix(path.relative(sourceRoot, filename)),
  }
}

interface SourceContext {
  projectRoot: string
  sourceRoot: string
  sourceRelativePath: string
}
