import node_path from 'node:path'

import ts from 'typescript'

import type { ProjectContext } from './ts-program.js'

export function resolveImportTarget(
  importerFile: string,
  context: ProjectContext,
  specifier: string,
): string | undefined {
  const result = ts.resolveModuleName(
    specifier,
    importerFile,
    context.compilerOptions,
    ts.sys,
    context.moduleResolutionCache,
  )

  const resolved = result.resolvedModule?.resolvedFileName
  if (resolved === undefined) return undefined
  if (result.resolvedModule?.isExternalLibraryImport === true) return undefined

  const absolute = node_path.resolve(resolved)
  const normalized = normalizeResolvedPath(resolved)
  if (!isInsidePath(context.projectRoot, normalized)) return undefined
  return absolute
}

export function isInsidePath(parent: string, child: string): boolean {
  const normalizedParent = normalizeResolvedPath(parent)
  const normalizedChild = normalizeResolvedPath(child)
  if (normalizedChild === normalizedParent) return true
  return normalizedChild.startsWith(`${normalizedParent}/`)
}

export function isSamePath(left: string, right: string): boolean {
  return normalizeResolvedPath(left) === normalizeResolvedPath(right)
}

export function getRelativePath(from: string, to: string): string {
  return normalizePath(node_path.relative(from, to))
}

export function normalizeResolvedPath(pathValue: string): string {
  return normalizePath(node_path.resolve(pathValue))
}

export function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

export function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/')
}
