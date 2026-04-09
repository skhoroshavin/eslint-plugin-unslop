import node_path from 'node:path'

import type { Rule } from 'eslint'

import { getTsconfigInfo, resolveExistingFile, resolvePathAlias } from './tsconfig-resolution.js'

import type { TsconfigInfo } from './tsconfig-resolution.js'

export function readArchitecturePolicy(context: Rule.RuleContext): ArchitecturePolicy | undefined {
  const unslopSettings = getUnslopSettings(context.settings)
  if (unslopSettings === undefined) return undefined

  const architecture = getArchitectureSettings(unslopSettings)
  if (architecture === undefined) return undefined

  const modules = parseArchitectureModules(architecture)
  if (modules.length === 0) return undefined

  const tsconfigInfo = getTsconfigInfo(context.filename)
  if (tsconfigInfo === undefined) {
    warnMissingTsconfig(context.filename)
    return undefined
  }

  return { tsconfigInfo, modules }
}

function getUnslopSettings(settings: unknown): Record<string, unknown> | undefined {
  if (!isRecord(settings)) return undefined
  const unslop = settings.unslop
  if (!isRecord(unslop)) return undefined
  return unslop
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
  const candidatePath = applySourceRoot(normalized, policy.tsconfigInfo)
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
  tsconfigInfo: TsconfigInfo
  modules: ArchitectureModuleDefinition[]
}

function applySourceRoot(pathValue: string, tsconfigInfo: TsconfigInfo): string | undefined {
  const projectRelative = normalizePath(node_path.relative(tsconfigInfo.projectRoot, pathValue))
  if (isOutsideProject(projectRelative)) return undefined

  const sourceRoot = tsconfigInfo.sourceRoot
  if (sourceRoot === undefined) return projectRelative

  const absoluteSourceRoot = node_path.resolve(tsconfigInfo.projectRoot, sourceRoot)
  const sourceRelative = normalizePath(node_path.relative(absoluteSourceRoot, pathValue))
  if (isOutsideProject(sourceRelative)) return undefined
  return sourceRelative
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
  tsconfigInfo: TsconfigInfo,
  specifier: string,
): string | undefined {
  if (!specifier.startsWith('.')) return resolvePathAlias(specifier, tsconfigInfo)
  const importerDir = node_path.dirname(importerFile)
  const base = node_path.resolve(importerDir, specifier)
  return resolveExistingFile(base)
}

export function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').split(node_path.sep).join('/')
}

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

interface ArchitectureModulePolicy {
  imports: string[]
  exports: string[]
  shared: boolean
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function isOutsideProject(pathValue: string): boolean {
  return pathValue === '..' || pathValue.startsWith('../') || node_path.isAbsolute(pathValue)
}

function warnMissingTsconfig(filename: string): void {
  if (warnedMissingTsconfigForFiles.has(filename)) return
  warnedMissingTsconfigForFiles.add(filename)
  console.warn(
    `[eslint-plugin-unslop] No tsconfig.json found for ${filename}. Architecture rules are disabled for this file.`,
  )
}

const warnedMissingTsconfigForFiles = new Set<string>()
