import node_path from 'node:path'

import type { Rule } from 'eslint'

import { createConfigurationErrorListeners } from './configuration-error.js'
import { formatProjectContextError, getRequiredTypeScriptProjectContext } from './ts-program.js'

import type { ProjectContext, ProjectContextError } from './ts-program.js'

import { getRelativePath, normalizePath, trimSlashes } from './tsconfig-resolution.js'

/**
 * Returns either error listeners (for config/context errors) or the active architecture state.
 * Callers can do: `const result = getArchitectureRule(context); if ('listener' in result) return result.listener`
 */
export function getArchitectureRuleListenerState(
  context: Rule.RuleContext,
): { listener: Rule.RuleListener } | { state: ArchitectureRuleState } {
  const state = getArchitectureRuleState(context)
  if (state.kind === 'config-error') {
    return { listener: createConfigurationErrorListeners(context, state.details) }
  }
  if (state.kind === 'context-error') {
    return {
      listener: createConfigurationErrorListeners(context, formatProjectContextError(state.error)),
    }
  }
  return { state }
}

export function getArchitectureRuleState(context: Rule.RuleContext): ArchitectureRuleState {
  const filename = context.filename
  if (filename.length === 0) return { kind: 'inactive' }

  const policy = readArchitecturePolicy(context)
  if (policy.kind !== 'active') return policy

  const moduleMatch = matchFileToArchitectureModule(filename, policy.policy)
  if (moduleMatch === undefined) return { kind: 'inactive' }

  return { kind: 'active', filename, policy: policy.policy, moduleMatch }
}

export function createArchitecturePolicy(
  architecture: Record<string, unknown>,
  projectContext: ProjectContext,
): ArchitecturePolicyResult {
  const modules = parseArchitectureModules(architecture)
  if (modules === undefined) return { kind: 'active', policy: { projectContext, modules: [] } }
  if ('details' in modules) return { kind: 'config-error', details: modules.details }
  return { kind: 'active', policy: { projectContext, modules } }
}

export function matchFileToArchitectureModule(
  filePath: string,
  policy: ArchitecturePolicy,
): MatchedArchitectureModule | undefined {
  const canonicalPath = getCanonicalModulePath(filePath, policy.projectContext)
  if (canonicalPath === undefined) return undefined

  return findBestModuleMatch(canonicalPath, policy.modules) ?? makeAnonymousModule(canonicalPath)
}

export function getCanonicalModulePath(
  filePath: string,
  projectContext: ProjectContext,
): string | undefined {
  const normalized = normalizePath(filePath)
  const candidatePath = applySourceRoot(normalized, projectContext)
  if (candidatePath === undefined) return undefined
  return getContainingModulePath(candidatePath)
}

type ArchitectureRuleState =
  | { kind: 'inactive' }
  | { kind: 'config-error'; details: string }
  | { kind: 'context-error'; filename: string; error: ProjectContextError }
  | {
      kind: 'active'
      filename: string
      policy: ArchitecturePolicy
      moduleMatch: MatchedArchitectureModule
    }

interface ArchitecturePolicy {
  projectContext: ProjectContext
  modules: ArchitectureModuleDefinition[]
}

type ArchitecturePolicyResult =
  | { kind: 'config-error'; details: string }
  | { kind: 'active'; policy: ArchitecturePolicy }

interface ArchitectureModuleDefinition {
  matcher: string
  kind: 'exact' | 'child-wildcard'
  pathSegments: string[]
  policy: ArchitectureModulePolicy
  order: number
}

interface MatchedArchitectureModule {
  canonicalPath: string
  ownerKey: string
  ownerPath: string
  policy: ArchitectureModulePolicy
  order: number
  anonymous: boolean
  ownerDepth: number
  isExact: boolean
  keyDepth: number
}

interface ArchitectureModulePolicy {
  imports: string[]
  typeImports: string[]
  exports: string[]
  entrypoints: string[]
  shared: boolean
}

// --- Internal helpers ---

function readArchitecturePolicy(context: Rule.RuleContext): PolicyReadResult {
  const architecture = getArchitectureSettings(context.settings)
  const modules = parseArchitectureModules(architecture)
  if ('details' in modules) return { kind: 'config-error', details: modules.details }

  const projectContext = getRequiredTypeScriptProjectContext(context.filename)
  if (projectContext.kind !== 'active') {
    return getArchitectureContextErrorState(context.filename, modules, projectContext.error)
  }

  return {
    kind: 'active',
    policy: { projectContext: projectContext.projectContext, modules },
  }
}

type PolicyReadResult =
  | { kind: 'config-error'; details: string }
  | { kind: 'context-error'; filename: string; error: ProjectContextError }
  | { kind: 'active'; policy: ArchitecturePolicy }

function getArchitectureContextErrorState(
  filename: string,
  modules: ArchitectureModuleDefinition[],
  error: ProjectContextError,
): PolicyReadResult {
  if (error.reason !== 'file-not-in-project' || error.projectContext === undefined) {
    return { kind: 'context-error', filename, error }
  }

  const policy = { projectContext: error.projectContext, modules }
  if (matchFileToArchitectureModule(filename, policy) === undefined) {
    return { kind: 'active', policy }
  }
  return { kind: 'context-error', filename, error }
}

function getArchitectureSettings(settings: unknown): Record<string, unknown> | undefined {
  if (!isRecord(settings)) return undefined
  const unslop = settings.unslop
  if (!isRecord(unslop)) return undefined
  const arch = unslop.architecture
  return isRecord(arch) ? arch : undefined
}

function parseArchitectureModules(
  architecture: Record<string, unknown> | undefined,
): ArchitectureModuleDefinition[] | { details: string } {
  if (architecture === undefined) return []
  const modules: ArchitectureModuleDefinition[] = []
  let order = 0
  for (const [matcher, rawPolicy] of Object.entries(architecture)) {
    const parsed = parseArchitectureMatcher(matcher)
    if (parsed === undefined) {
      return { details: getUnsupportedArchitectureKeyDetails(matcher) }
    }

    const policy = parseModulePolicy(rawPolicy)
    if (policy === undefined) continue

    modules.push({ ...parsed, policy, order })
    order += 1
  }
  return modules
}

function parseArchitectureMatcher(matcher: string): ParsedMatcher | undefined {
  const trimmed = trimSlashes(matcher.trim())
  if (trimmed.length === 0) return undefined

  if (trimmed === '.') {
    return { matcher: trimmed, kind: 'exact', pathSegments: [] }
  }

  const segments = trimmed.split('/').filter(Boolean)
  const wildcard = segments.at(-1) === '*'

  if (!isValidSelector(segments, wildcard)) return undefined

  return wildcard
    ? { matcher: trimmed, kind: 'child-wildcard', pathSegments: segments.slice(0, -1) }
    : { matcher: trimmed, kind: 'exact', pathSegments: segments }
}

interface ParsedMatcher {
  matcher: string
  kind: 'exact' | 'child-wildcard'
  pathSegments: string[]
}

function isValidSelector(segments: string[], wildcard: boolean): boolean {
  if (segments.length === 0) return false
  if (wildcard && segments.length === 1) return false
  if (segments.some((s) => s === '.' || s === '..')) return false

  const lastIndex = segments.length - 1
  return segments.every((segment, index) => {
    if (wildcard && index === lastIndex) return segment === '*'
    return isNamedSegment(segment)
  })
}

function isNamedSegment(segment: string): boolean {
  if (segment.length === 0) return false
  if (segment.includes('*') || segment.includes('+')) return false
  return !/\.[A-Za-z0-9]+$/.test(segment)
}

function getUnsupportedArchitectureKeyDetails(matcher: string): string {
  return `unsupported architecture key selector "${matcher}". Use ".", directory-shaped selectors like "models", or terminal child selectors like "models/*".`
}

function parseModulePolicy(rawPolicy: unknown): ArchitectureModulePolicy | undefined {
  if (!isRecord(rawPolicy)) return undefined
  const imports = readStringList(rawPolicy.imports)
  const typeImports = readStringList(rawPolicy.typeImports)
  const exports = readStringList(rawPolicy.exports)
  const entrypoints = readStringList(rawPolicy.entrypoints)
  const shared = rawPolicy.shared === true
  return {
    imports,
    typeImports,
    exports,
    entrypoints: entrypoints.length > 0 ? entrypoints : ['index.ts'],
    shared,
  }
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function applySourceRoot(pathValue: string, projectContext: ProjectContext): string | undefined {
  const projectRelative = getRelativePath(projectContext.projectRoot, pathValue)
  if (isOutsidePath(projectRelative)) return undefined

  const sourceRoot = projectContext.sourceRoot
  if (sourceRoot === undefined) return projectRelative

  const absoluteSourceRoot = node_path.resolve(projectContext.projectRoot, sourceRoot)
  const sourceRelative = getRelativePath(absoluteSourceRoot, pathValue)
  return isOutsidePath(sourceRelative) ? undefined : sourceRelative
}

function getContainingModulePath(relativePath: string): string {
  const segments = relativePath.split('/').filter(Boolean)
  return segments.length <= 1 ? '.' : segments.slice(0, -1).join('/')
}

function findBestModuleMatch(
  canonicalPath: string,
  modules: ArchitectureModuleDefinition[],
): MatchedArchitectureModule | undefined {
  const canonicalSegments = canonicalPath === '.' ? [] : canonicalPath.split('/').filter(Boolean)
  let best: MatchedArchitectureModule | undefined

  for (const mod of modules) {
    const matched =
      mod.kind === 'child-wildcard'
        ? matchChildWildcard(canonicalPath, canonicalSegments, mod)
        : matchExact(canonicalPath, canonicalSegments, mod)

    if (matched === undefined) continue
    if (best === undefined || compareMatches(matched, best) < 0) {
      best = matched
    }
  }
  return best
}

function matchExact(
  canonicalPath: string,
  canonicalSegments: string[],
  mod: ArchitectureModuleDefinition,
): MatchedArchitectureModule | undefined {
  if (!startsWithSegments(canonicalSegments, mod.pathSegments)) return undefined
  return buildMatch(canonicalPath, mod, joinSegments(mod.pathSegments))
}

function matchChildWildcard(
  canonicalPath: string,
  canonicalSegments: string[],
  mod: ArchitectureModuleDefinition,
): MatchedArchitectureModule | undefined {
  if (canonicalSegments.length <= mod.pathSegments.length) return undefined
  if (!startsWithSegments(canonicalSegments, mod.pathSegments)) return undefined

  const ownerSegments = canonicalSegments.slice(0, mod.pathSegments.length + 1)
  return buildMatch(canonicalPath, mod, joinSegments(ownerSegments))
}

function buildMatch(
  canonicalPath: string,
  mod: ArchitectureModuleDefinition,
  ownerPath: string,
): MatchedArchitectureModule {
  const ownerDepth =
    mod.kind === 'child-wildcard' ? mod.pathSegments.length + 1 : mod.pathSegments.length
  return {
    canonicalPath,
    ownerKey: mod.matcher,
    ownerPath,
    policy: mod.policy,
    order: mod.order,
    anonymous: false,
    ownerDepth,
    isExact: mod.kind === 'exact',
    keyDepth: mod.pathSegments.length,
  }
}

function makeAnonymousModule(canonicalPath: string): MatchedArchitectureModule {
  const depth = canonicalPath.split('/').filter(Boolean).length
  return {
    canonicalPath,
    ownerKey: canonicalPath,
    ownerPath: canonicalPath,
    policy: {
      imports: [],
      typeImports: [],
      exports: [],
      entrypoints: ['index.ts'],
      shared: false,
    },
    order: 0,
    anonymous: true,
    ownerDepth: depth,
    isExact: true,
    keyDepth: depth,
  }
}

function compareMatches(left: MatchedArchitectureModule, right: MatchedArchitectureModule): number {
  if (left.ownerDepth !== right.ownerDepth) return right.ownerDepth - left.ownerDepth
  if (left.isExact !== right.isExact) return left.isExact ? -1 : 1
  if (left.keyDepth !== right.keyDepth) return right.keyDepth - left.keyDepth
  return left.order - right.order
}

function startsWithSegments(segments: string[], prefix: string[]): boolean {
  if (prefix.length > segments.length) return false
  return prefix.every((segment, index) => segments[index] === segment)
}

function joinSegments(segments: string[]): string {
  return segments.length > 0 ? segments.join('/') : '.'
}

function isOutsidePath(pathValue: string): boolean {
  return pathValue === '..' || pathValue.startsWith('../') || node_path.isAbsolute(pathValue)
}
