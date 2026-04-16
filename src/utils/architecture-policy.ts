import node_path from 'node:path'

import type { Rule } from 'eslint'

import { createConfigurationErrorListeners } from './configuration-error.js'
import { getRequiredTypeScriptProjectContext } from './ts-program.js'
import { formatProjectContextError } from './ts-program.js'

import type { ProjectContext, ProjectContextError } from './ts-program.js'

import { getRelativePath, normalizePath, trimSlashes } from './tsconfig-resolution.js'

export function getArchitectureRuleListenerState(
  context: Rule.RuleContext,
): ArchitectureRuleListenerState {
  const state = getArchitectureRuleState(context)
  if (state.kind === 'config-error') {
    return { kind: 'listener', listener: createConfigurationErrorListeners(context, state.details) }
  }
  if (state.kind === 'context-error') {
    return {
      kind: 'listener',
      listener: createConfigurationErrorListeners(context, formatProjectContextError(state.error)),
    }
  }
  return { kind: 'state', state }
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
): ArchitecturePolicyState {
  const modules = parseArchitectureModules(architecture)
  if (modules.kind !== 'active') return modules
  return { kind: 'active', policy: { projectContext, modules: modules.modules } }
}

export function matchFileToArchitectureModule(
  filePath: string,
  policy: ArchitecturePolicy,
): MatchedArchitectureModule | undefined {
  const canonicalPath = getCanonicalModulePath(filePath, policy.projectContext)
  if (canonicalPath === undefined) return undefined

  const matches = collectModuleMatches(canonicalPath, policy.modules)
  return pickBestMatch(matches) ?? makeAnonymousModule(canonicalPath)
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

type ArchitecturePolicyState =
  | { kind: 'inactive' }
  | { kind: 'config-error'; details: string }
  | { kind: 'context-error'; filename: string; error: ProjectContextError }
  | { kind: 'active'; policy: ArchitecturePolicy }

interface ArchitectureModuleDefinition {
  matcher: string
  kind: ArchitectureSelectorKind
  pathSegments: string[]
  policy: ArchitectureModulePolicy
  order: number
}

type ArchitectureSelectorKind = 'exact' | 'child-wildcard'

type ArchitectureRuleListenerState =
  | { kind: 'listener'; listener: Rule.RuleListener }
  | { kind: 'state'; state: ArchitectureRuleState }

interface MatchedArchitectureModule {
  canonicalPath: string
  ownerKey: string
  ownerPath: string
  policy: ArchitectureModulePolicy
  order: number
  anonymous: boolean
}

interface ArchitectureModulePolicy {
  imports: string[]
  exports: string[]
  entrypoints: string[]
  shared: boolean
}

function readArchitecturePolicy(context: Rule.RuleContext): ArchitecturePolicyState {
  const architecture = getArchitectureSettings(context.settings)
  if (architecture === undefined) return { kind: 'inactive' }

  const modules = parseArchitectureModules(architecture)
  if (modules.kind !== 'active') return modules
  if (modules.modules.length === 0) return { kind: 'inactive' }

  const projectContext = getRequiredTypeScriptProjectContext(context.filename)
  if (projectContext.kind !== 'active') {
    return getArchitectureContextErrorState(context.filename, modules.modules, projectContext.error)
  }

  return {
    kind: 'active',
    policy: { projectContext: projectContext.projectContext, modules: modules.modules },
  }
}

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
): ParsedArchitectureModulesResult {
  const modules: ArchitectureModuleDefinition[] = []
  let order = 0
  for (const [matcher, rawPolicy] of Object.entries(architecture)) {
    const parsedMatcher = parseArchitectureMatcher(matcher)
    if (parsedMatcher.kind !== 'valid') return parsedMatcher

    const parsedPolicy = parseModulePolicy(rawPolicy)
    if (parsedPolicy === undefined) continue

    modules.push({
      matcher: parsedMatcher.matcher,
      kind: parsedMatcher.selectorKind,
      pathSegments: parsedMatcher.pathSegments,
      policy: parsedPolicy,
      order,
    })
    order += 1
  }
  return { kind: 'active', modules }
}

type ParsedArchitectureModulesResult =
  | { kind: 'config-error'; details: string }
  | { kind: 'active'; modules: ArchitectureModuleDefinition[] }

function parseArchitectureMatcher(matcher: string): ParsedArchitectureMatcherResult {
  const normalizedMatcher = normalizeArchitectureMatcher(matcher)
  if (normalizedMatcher === undefined) {
    return { kind: 'config-error', details: getUnsupportedArchitectureKeyDetails(matcher) }
  }

  if (normalizedMatcher === '.') {
    return {
      kind: 'valid',
      matcher: normalizedMatcher,
      selectorKind: 'exact',
      pathSegments: [],
    }
  }

  const segments = splitSelectorSegments(normalizedMatcher)
  const wildcard = segments.at(-1) === '*'
  if (!isSupportedArchitectureSelector(segments, wildcard)) {
    return { kind: 'config-error', details: getUnsupportedArchitectureKeyDetails(matcher) }
  }

  return wildcard
    ? {
        kind: 'valid',
        matcher: normalizedMatcher,
        selectorKind: 'child-wildcard',
        pathSegments: segments.slice(0, -1),
      }
    : {
        kind: 'valid',
        matcher: normalizedMatcher,
        selectorKind: 'exact',
        pathSegments: segments,
      }
}

type ParsedArchitectureMatcherResult =
  | { kind: 'config-error'; details: string }
  | {
      kind: 'valid'
      matcher: string
      selectorKind: ArchitectureSelectorKind
      pathSegments: string[]
    }

function normalizeArchitectureMatcher(matcher: string): string | undefined {
  const trimmed = trimSlashes(matcher.trim())
  return trimmed.length > 0 ? trimmed : undefined
}

function isSupportedArchitectureSelector(segments: string[], wildcard: boolean): boolean {
  if (segments.length === 0) return false
  if (wildcard && segments.length === 1) return false
  if (segments.some((segment) => segment === '.' || segment === '..')) return false

  const finalIndex = segments.length - 1
  return segments.every((segment, index) => {
    if (wildcard && index === finalIndex) return segment === '*'
    return isNamedArchitectureSegment(segment)
  })
}

function isNamedArchitectureSegment(segment: string): boolean {
  if (segment.length === 0) return false
  if (segment.includes('*') || segment.includes('+')) return false
  return !isFileShapedSegment(segment)
}

function isFileShapedSegment(segment: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(segment)
}

function getUnsupportedArchitectureKeyDetails(matcher: string): string {
  return `unsupported architecture key selector "${matcher}". Use ".", directory-shaped selectors like "models", or terminal child selectors like "models/*".`
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

function getRecordProperty(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined
  const property = value[key]
  if (!isRecord(property)) return undefined
  return property
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function getContainingModulePath(relativePath: string): string {
  const segments = splitSelectorSegments(relativePath)
  if (segments.length <= 1) return '.'
  return joinModulePath(segments.slice(0, -1))
}

function collectModuleMatches(
  canonicalPath: string,
  modules: ArchitectureModuleDefinition[],
): MatchedArchitectureModule[] {
  const canonicalSegments = splitModulePath(canonicalPath)
  const matches: MatchedArchitectureModule[] = []
  for (const module of modules) {
    const matched = matchArchitectureModule(canonicalPath, canonicalSegments, module)
    if (matched !== undefined) {
      matches.push(matched)
    }
  }
  return matches
}

function matchArchitectureModule(
  canonicalPath: string,
  canonicalSegments: string[],
  module: ArchitectureModuleDefinition,
): MatchedArchitectureModule | undefined {
  return module.kind === 'child-wildcard'
    ? matchChildWildcardModule(canonicalPath, canonicalSegments, module)
    : matchExactModule(canonicalPath, canonicalSegments, module)
}

function matchExactModule(
  canonicalPath: string,
  canonicalSegments: string[],
  module: ArchitectureModuleDefinition,
): MatchedArchitectureModule | undefined {
  if (!startsWithSegments(canonicalSegments, module.pathSegments)) return undefined
  return makeMatchedModule(canonicalPath, module, joinModulePath(module.pathSegments))
}

function matchChildWildcardModule(
  canonicalPath: string,
  canonicalSegments: string[],
  module: ArchitectureModuleDefinition,
): MatchedArchitectureModule | undefined {
  if (canonicalSegments.length <= module.pathSegments.length) return undefined
  if (!startsWithSegments(canonicalSegments, module.pathSegments)) return undefined

  const ownerSegments = canonicalSegments.slice(0, module.pathSegments.length + 1)
  return makeMatchedModule(canonicalPath, module, joinModulePath(ownerSegments))
}

function makeMatchedModule(
  canonicalPath: string,
  module: ArchitectureModuleDefinition,
  ownerPath: string,
): MatchedArchitectureModule {
  return {
    canonicalPath,
    ownerKey: module.matcher,
    ownerPath,
    policy: module.policy,
    order: module.order,
    anonymous: false,
  }
}

function makeAnonymousModule(canonicalPath: string): MatchedArchitectureModule {
  return {
    canonicalPath,
    ownerKey: canonicalPath,
    ownerPath: canonicalPath,
    policy: { imports: [], exports: [], entrypoints: ['index.ts'], shared: false },
    order: 0,
    anonymous: true,
  }
}

function pickBestMatch(
  matches: MatchedArchitectureModule[],
): MatchedArchitectureModule | undefined {
  if (matches.length === 0) return undefined
  const sorted = [...matches].sort(compareMatches)
  return sorted[0]
}

function compareMatches(left: MatchedArchitectureModule, right: MatchedArchitectureModule): number {
  const leftOwnerDepth = splitModulePath(left.ownerPath).length
  const rightOwnerDepth = splitModulePath(right.ownerPath).length
  if (leftOwnerDepth !== rightOwnerDepth) {
    return rightOwnerDepth - leftOwnerDepth
  }

  const leftExact = !left.ownerKey.endsWith('/*')
  const rightExact = !right.ownerKey.endsWith('/*')
  if (leftExact !== rightExact) {
    return leftExact ? -1 : 1
  }

  const leftKeyDepth = splitSelectorSegments(left.ownerKey).length
  const rightKeyDepth = splitSelectorSegments(right.ownerKey).length
  if (leftKeyDepth !== rightKeyDepth) {
    return rightKeyDepth - leftKeyDepth
  }

  return left.order - right.order
}

function startsWithSegments(segments: string[], prefix: string[]): boolean {
  if (prefix.length > segments.length) return false
  return prefix.every((segment, index) => segments[index] === segment)
}

function splitModulePath(pathValue: string): string[] {
  return pathValue === '.' ? [] : splitSelectorSegments(pathValue)
}

function splitSelectorSegments(pathValue: string): string[] {
  return pathValue.split('/').filter(Boolean)
}

function joinModulePath(segments: string[]): string {
  return segments.length > 0 ? segments.join('/') : '.'
}

function isOutsideProject(pathValue: string): boolean {
  return pathValue === '..' || pathValue.startsWith('../') || node_path.isAbsolute(pathValue)
}
