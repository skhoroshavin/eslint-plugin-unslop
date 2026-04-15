import node_path from 'node:path'

import type { Rule } from 'eslint'

import { getRequiredTypeScriptProjectContext } from './ts-program.js'

import type { ProjectContext, ProjectContextError } from './ts-program.js'

import { getRelativePath, normalizePath, trimSlashes } from './tsconfig-resolution.js'

export function getArchitectureRuleState(context: Rule.RuleContext): ArchitectureRuleState {
  const filename = context.filename
  if (filename.length === 0) return { kind: 'inactive' }

  const policy = readArchitecturePolicy(context)
  if (policy.kind !== 'active') return policy

  const moduleMatch = matchFileToArchitectureModule(filename, policy.policy)
  if (moduleMatch === undefined) return { kind: 'inactive' }

  return { kind: 'active', filename, policy: policy.policy, moduleMatch }
}

export function matchFileToArchitectureModule(
  filePath: string,
  policy: ArchitecturePolicy,
): MatchedArchitectureModule | undefined {
  const normalized = normalizePath(filePath)
  const candidatePath = applySourceRoot(normalized, policy.projectContext)
  if (candidatePath === undefined) return undefined
  const segments = splitPathSegments(candidatePath)
  const matches = collectModuleMatches(segments, policy.modules)
  return pickBestMatch(matches) ?? makeDefaultModule(candidatePath)
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

type ArchitectureRuleState =
  | { kind: 'inactive' }
  | { kind: 'context-error'; filename: string; error: ProjectContextError }
  | {
      kind: 'active'
      filename: string
      policy: ArchitecturePolicy
      moduleMatch: MatchedArchitectureModule
    }

function readArchitecturePolicy(context: Rule.RuleContext): ArchitecturePolicyState {
  const architecture = getArchitectureSettings(context.settings)
  if (architecture === undefined) return { kind: 'inactive' }

  const modules = parseArchitectureModules(architecture)
  if (modules.length === 0) return { kind: 'inactive' }

  const projectContext = getRequiredTypeScriptProjectContext(context.filename)
  if (projectContext.kind !== 'active') {
    return getArchitectureContextErrorState(context.filename, modules, projectContext.error)
  }

  return {
    kind: 'active',
    policy: { projectContext: projectContext.projectContext, modules },
  }
}

interface ArchitecturePolicy {
  projectContext: ProjectContext
  modules: ArchitectureModuleDefinition[]
}

type ArchitecturePolicyState =
  | { kind: 'inactive' }
  | { kind: 'context-error'; filename: string; error: ProjectContextError }
  | { kind: 'active'; policy: ArchitecturePolicy }

function getArchitectureContextErrorState(
  filename: string,
  modules: ArchitectureModuleDefinition[],
  error: ProjectContextError,
): ArchitecturePolicyState {
  if (error.reason !== 'file-not-in-project' || error.projectContext === undefined) {
    return { kind: 'context-error', filename, error }
  }

  const policy = { projectContext: error.projectContext, modules }
  return matchFileToArchitectureModule(filename, policy) === undefined
    ? { kind: 'inactive' }
    : { kind: 'context-error', filename, error }
}

function getArchitectureSettings(settings: unknown): Record<string, unknown> | undefined {
  const unslop = getRecordProperty(settings, 'unslop')
  return getRecordProperty(unslop, 'architecture')
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
  const entrypoints = readEntrypoints(rawPolicy.entrypoints)
  const shared = rawPolicy.shared === true
  return { imports, exports, entrypoints, shared }
}

function readEntrypoints(value: unknown): string[] {
  const configured = readStringList(value)
  return configured.length > 0 ? configured : ['index.ts']
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

function getRecordProperty(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined
  const property = value[key]
  if (!isRecord(property)) return undefined
  return property
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function makeDefaultModule(relativePath: string): MatchedArchitectureModule {
  const segments = splitPathSegments(relativePath)
  const dirSegments = segments.slice(0, -1)
  const key = dirSegments.length > 0 ? dirSegments.join('/') : (segments[0] ?? '.')
  return {
    matcher: key,
    instance: key,
    policy: { imports: [], exports: [], entrypoints: ['index.ts'], shared: false },
    order: 0,
  }
}

function applySourceRoot(pathValue: string, projectContext: ProjectContext): string | undefined {
  const projectRelative = getRelativePath(projectContext.projectRoot, pathValue)
  if (isOutsideProject(projectRelative)) return undefined

  const sourceRoot = projectContext.sourceRoot
  if (sourceRoot === undefined) return projectRelative

  const absoluteSourceRoot = node_path.resolve(projectContext.projectRoot, sourceRoot)
  const sourceRelative = getRelativePath(absoluteSourceRoot, pathValue)
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

interface ArchitectureModulePolicy {
  imports: string[]
  exports: string[]
  entrypoints: string[]
  shared: boolean
}

function countWildcards(value: string): number {
  return value.split('*').length - 1
}

function isOutsideProject(pathValue: string): boolean {
  return pathValue === '..' || pathValue.startsWith('../') || node_path.isAbsolute(pathValue)
}
