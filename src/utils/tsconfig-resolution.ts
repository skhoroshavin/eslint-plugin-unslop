import node_fs from 'node:fs'

import node_path from 'node:path'

import { createPathsMatcher, getTsconfig } from 'get-tsconfig'

import type { Cache, TsConfigResult } from 'get-tsconfig'

export function getTsconfigInfo(filename: string): TsconfigInfo | undefined {
  const searchPath = node_path.dirname(filename)
  const tsconfig = getTsconfig(searchPath, 'tsconfig.json', tsconfigSearchCache)
  if (tsconfig === null) return undefined

  const cached = tsconfigInfoCache.get(tsconfig.path)
  if (cached !== undefined) {
    return cached === null ? undefined : cached
  }

  const info = parseTsconfigInfo(tsconfig)
  tsconfigInfoCache.set(tsconfig.path, info ?? null)
  return info
}

export function resolvePathAlias(specifier: string, info: TsconfigInfo): string | undefined {
  if (info.pathsMatcher === null) return undefined
  const candidates = info.pathsMatcher(specifier)
  const [first] = candidates
  if (first === undefined) return undefined
  return resolveExistingFile(first)
}

export interface TsconfigInfo {
  projectRoot: string
  sourceRoot: string | undefined
  pathsMatcher: ((specifier: string) => string[]) | null
}

export function resolveExistingFile(basePath: string): string | undefined {
  const candidates = buildCandidates(basePath)
  for (const candidate of candidates) {
    const resolved = resolveCandidate(candidate)
    if (resolved !== undefined) return resolved
  }
  return undefined
}

function parseTsconfigInfo(tsconfig: TsConfigResult): TsconfigInfo {
  const projectRoot = node_path.dirname(tsconfig.path)
  return {
    projectRoot,
    sourceRoot: deriveSourceRoot(tsconfig, projectRoot),
    pathsMatcher: createPathsMatcher(tsconfig),
  }
}

function deriveSourceRoot(tsconfig: TsConfigResult, projectRoot: string): string | undefined {
  const compilerOptions = tsconfig.config.compilerOptions
  if (compilerOptions === undefined) return undefined

  const rootDir = normalizeSourceRootCandidate(compilerOptions.rootDir, projectRoot)
  if (rootDir !== undefined) return rootDir

  const pathsRoot = inferSourceRootFromPaths(compilerOptions.paths, projectRoot)
  if (pathsRoot !== undefined) return pathsRoot

  return normalizeSourceRootCandidate(compilerOptions.baseUrl, projectRoot)
}

function inferSourceRootFromPaths(
  paths: Record<string, string[]> | undefined,
  projectRoot: string,
): string | undefined {
  if (paths === undefined) return undefined
  for (const targets of Object.values(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue
    const firstTarget = targets[0]
    if (typeof firstTarget !== 'string') continue
    const wildcardIndex = firstTarget.indexOf('*')
    const withoutWildcard = wildcardIndex === -1 ? firstTarget : firstTarget.slice(0, wildcardIndex)
    const normalized = normalizeSourceRootCandidate(withoutWildcard, projectRoot)
    if (normalized !== undefined) return normalized
  }
  return undefined
}

function normalizeSourceRootCandidate(
  value: string | undefined,
  projectRoot: string,
): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  const absolute = node_path.isAbsolute(trimmed)
    ? node_path.normalize(trimmed)
    : node_path.resolve(projectRoot, trimmed)
  const relative = normalizePath(node_path.relative(projectRoot, absolute))
  if (relative === '' || relative === '.' || isOutsideProject(relative)) return undefined
  return trimSlashes(relative)
}

function resolveCandidate(candidate: string): string | undefined {
  if (!node_fs.existsSync(candidate)) return undefined
  const stat = node_fs.statSync(candidate)
  if (stat.isFile()) return candidate
  if (!stat.isDirectory()) return undefined

  for (const extension of FILE_EXTENSIONS.slice(1)) {
    const indexPath = node_path.join(candidate, `index${extension}`)
    if (!node_fs.existsSync(indexPath)) continue
    const indexStat = node_fs.statSync(indexPath)
    if (indexStat.isFile()) return indexPath
  }
  return undefined
}

function buildCandidates(basePath: string): string[] {
  const candidates: string[] = []
  for (const extension of FILE_EXTENSIONS) {
    candidates.push(basePath + extension)
  }

  for (const extension of FILE_EXTENSIONS.slice(1)) {
    candidates.push(node_path.join(basePath, `index${extension}`))
  }

  for (const extension of JS_IMPORT_EXTENSIONS) {
    if (!basePath.endsWith(extension)) continue
    const tsExtension = extension === '.jsx' ? '.tsx' : '.ts'
    candidates.push(basePath.slice(0, -extension.length) + tsExtension)
  }
  return candidates
}

const JS_IMPORT_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs']

const FILE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

function trimSlashes(value: string): string {
  return value.replace(/^\/+/g, '').replace(/\/+$/g, '')
}

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').split(node_path.sep).join('/')
}

function isOutsideProject(relativePath: string): boolean {
  return (
    relativePath === '..' || relativePath.startsWith('../') || node_path.isAbsolute(relativePath)
  )
}

const tsconfigSearchCache: Cache = new Map()

const tsconfigInfoCache = new Map<string, TsconfigInfo | null>()
