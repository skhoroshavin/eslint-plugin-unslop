import node_fs from 'node:fs'

import node_path from 'node:path'

import type { Rule } from 'eslint'

export function readArchitecturePolicy(context: Rule.RuleContext): ArchitecturePolicy | undefined {
  const unslopSettings = getUnslopSettings(context.settings)
  if (unslopSettings === undefined) return undefined

  const sourceRoot = getSourceRoot(unslopSettings)
  const architecture = getArchitectureSettings(unslopSettings)
  if (architecture === undefined) return undefined

  const modules = parseArchitectureModules(architecture)
  if (modules.length === 0) return undefined

  return { sourceRoot, modules }
}

function getUnslopSettings(settings: unknown): Record<string, unknown> | undefined {
  if (!isRecord(settings)) return undefined
  const unslop = settings.unslop
  if (!isRecord(unslop)) return undefined
  return unslop
}

function getSourceRoot(unslopSettings: Record<string, unknown>): string | undefined {
  if (typeof unslopSettings.sourceRoot !== 'string') return undefined
  const trimmed = trimSlashes(unslopSettings.sourceRoot)
  return trimmed.length > 0 ? trimmed : undefined
}

function getArchitectureSettings(
  unslopSettings: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const architecture = unslopSettings.architecture
  if (!isRecord(architecture)) return undefined
  return architecture
}

function parseArchitectureModules(
  architecture: Record<string, unknown>,
): ArchitectureModuleDefinition[] {
  const modules: ArchitectureModuleDefinition[] = []
  let order = 0
  for (const [matcher, rawPolicy] of Object.entries(architecture)) {
    if (!isValidMatcher(matcher)) continue
    const parsed = parseModulePolicy(rawPolicy)
    if (parsed === undefined) continue
    modules.push({ matcher: trimSlashes(matcher), policy: parsed, order })
    order += 1
  }
  return modules
}

function parseModulePolicy(rawPolicy: unknown): ArchitectureModulePolicy | undefined {
  if (!isRecord(rawPolicy)) return undefined
  const imports = readStringList(rawPolicy.imports)
  const exports = readStringList(rawPolicy.exports)
  const shared = rawPolicy.shared === true
  return { imports, exports, shared }
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      result.push(entry)
    }
  }
  return result
}

function isValidMatcher(matcher: string): boolean {
  if (matcher.trim().length === 0) return false
  return !matcher.includes('**')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function matchFileToArchitectureModule(
  filePath: string,
  policy: ArchitecturePolicy,
): MatchedArchitectureModule | undefined {
  const normalized = normalizePath(filePath)
  const candidatePath = applySourceRoot(normalized, policy.sourceRoot)
  if (candidatePath === undefined) return undefined
  const segments = splitPathSegments(candidatePath)
  const matches = collectModuleMatches(segments, policy.modules)
  return pickBestMatch(matches) ?? makeDefaultModule(candidatePath)
}

function makeDefaultModule(relativePath: string): MatchedArchitectureModule {
  const segments = splitPathSegments(relativePath)
  const dirSegments = segments.slice(0, -1)
  const key = dirSegments.length > 0 ? dirSegments.join('/') : (segments[0] ?? '.')
  return {
    matcher: key,
    instance: key,
    policy: { imports: [], exports: [], shared: false },
    order: 0,
  }
}

interface ArchitecturePolicy {
  sourceRoot?: string
  modules: ArchitectureModuleDefinition[]
}

function applySourceRoot(pathValue: string, sourceRoot?: string): string | undefined {
  if (sourceRoot === undefined) return pathValue
  const withSlashes = `/${sourceRoot}/`
  const index = pathValue.indexOf(withSlashes)
  if (index === -1) return undefined
  return pathValue.slice(index + withSlashes.length)
}

function collectModuleMatches(
  segments: string[],
  modules: ArchitectureModuleDefinition[],
): MatchedArchitectureModule[] {
  const matches: MatchedArchitectureModule[] = []
  for (const module of modules) {
    const matched = matchModuleAtOffset0(segments, module)
    if (matched !== undefined) {
      matches.push(matched)
    }
  }
  return matches
}

function matchModuleAtOffset0(
  segments: string[],
  module: ArchitectureModuleDefinition,
): MatchedArchitectureModule | undefined {
  const matcherSegments = splitPathSegments(module.matcher)
  const instance = matchAtOffset(segments, matcherSegments, 0)
  if (instance === undefined) return undefined
  return {
    matcher: module.matcher,
    instance,
    policy: module.policy,
    order: module.order,
  }
}

interface ArchitectureModuleDefinition {
  matcher: string
  policy: ArchitectureModulePolicy
  order: number
}

function splitPathSegments(pathValue: string): string[] {
  return pathValue.split('/').filter(Boolean)
}

function matchAtOffset(
  segments: string[],
  matcherSegments: string[],
  start: number,
): string | undefined {
  if (start + matcherSegments.length > segments.length) return undefined
  const instanceParts: string[] = []
  for (let index = 0; index < matcherSegments.length; index++) {
    const matcherPart = matcherSegments[index]
    const segmentPart = segments[start + index]
    if (matcherPart === '*') {
      instanceParts.push(segmentPart)
      continue
    }
    if (matcherPart !== segmentPart) return undefined
    instanceParts.push(matcherPart)
  }
  return instanceParts.join('/')
}

function pickBestMatch(
  matches: MatchedArchitectureModule[],
): MatchedArchitectureModule | undefined {
  if (matches.length === 0) return undefined
  const sorted = [...matches].sort(compareMatches)
  return sorted[0]
}

function compareMatches(left: MatchedArchitectureModule, right: MatchedArchitectureModule): number {
  const leftWildcards = countWildcards(left.matcher)
  const rightWildcards = countWildcards(right.matcher)
  if (leftWildcards !== rightWildcards) {
    return leftWildcards - rightWildcards
  }
  if (left.matcher.length !== right.matcher.length) {
    return right.matcher.length - left.matcher.length
  }
  return left.order - right.order
}

interface MatchedArchitectureModule {
  matcher: string
  instance: string
  policy: ArchitectureModulePolicy
  order: number
}

function countWildcards(value: string): number {
  return value.split('*').length - 1
}

export function resolveImportTarget(
  importerFile: string,
  sourceRoot: string | undefined,
  specifier: string,
): string | undefined {
  if (!isLocalSpecifier(specifier)) return undefined
  const importerDir = node_path.dirname(importerFile)
  if (specifier.startsWith('@/')) {
    return resolveAliasImport(importerFile, sourceRoot, specifier)
  }
  const base = node_path.resolve(importerDir, specifier)
  return resolveInsideSourceRoot(resolveExistingFile(base), sourceRoot)
}

function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/')
}

function resolveAliasImport(
  importerFile: string,
  sourceRoot: string | undefined,
  specifier: string,
): string | undefined {
  if (sourceRoot === undefined) return undefined
  const normalized = normalizePath(importerFile)
  const marker = `/${sourceRoot}/`
  const index = normalized.indexOf(marker)
  if (index === -1) return undefined
  const projectRoot = normalized.slice(0, index)
  const remainder = specifier.slice(2)
  const base = node_path.join(projectRoot, sourceRoot, remainder)
  return resolveInsideSourceRoot(resolveExistingFile(base), sourceRoot)
}

function resolveInsideSourceRoot(
  filePath: string | undefined,
  sourceRoot: string | undefined,
): string | undefined {
  if (filePath === undefined) return undefined
  if (sourceRoot === undefined) return filePath
  const normalized = normalizePath(filePath)
  const marker = `/${sourceRoot}/`
  return normalized.includes(marker) ? filePath : undefined
}

export function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').split(node_path.sep).join('/')
}

function resolveExistingFile(basePath: string): string | undefined {
  const candidates = buildCandidates(basePath)
  for (const candidate of candidates) {
    const resolved = resolveCandidate(candidate)
    if (resolved !== undefined) return resolved
  }
  return undefined
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

export function isPublicEntrypoint(filePath: string): boolean {
  return ENTRYPOINT_FILES.has(node_path.basename(filePath))
}

const ENTRYPOINT_FILES = new Set([
  'index.ts',
  'index.tsx',
  'index.js',
  'index.jsx',
  'types.ts',
  'types.tsx',
  'types.js',
  'types.jsx',
])

export function isRelativeTooDeep(specifier: string): boolean {
  if (!specifier.startsWith('./')) return false
  const parts = specifier.slice(2).split('/').filter(Boolean)
  const depth = Math.max(parts.length - 1, 0)
  return depth > 1
}

export function allowsImport(policy: ArchitectureModulePolicy, targetMatcher: string): boolean {
  return policy.imports.includes('*') || policy.imports.includes(targetMatcher)
}

interface ArchitectureModulePolicy {
  imports: string[]
  exports: string[]
  shared: boolean
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}
