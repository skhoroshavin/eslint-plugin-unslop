import node_path from 'node:path'

import type { Rule } from 'eslint'

import { ProjectContext, normalizePath } from './project-context.js'

export class ArchitecturePolicyResolver {
  constructor(
    private readonly policy: ArchitecturePolicy,
    private readonly projectContext: ProjectContext,
  ) {}

  static fromContext(context: Rule.RuleContext): ArchitecturePolicyResolver | undefined {
    const policy = readArchitecturePolicy(context)
    if (policy === undefined) return undefined
    const filename = context.filename
    if (typeof filename !== 'string' || filename.length === 0) return undefined
    const projectRoot =
      policy.sourceRoot === undefined ? undefined : deriveProjectRoot(filename, policy.sourceRoot)
    const projectContext = ProjectContext.forFile(filename, {
      sourceRoot: policy.sourceRoot,
      projectRoot,
    })
    return new ArchitecturePolicyResolver(policy, projectContext)
  }

  matchFile(filePath: string): MatchedArchitectureModule | undefined {
    const candidatePath = getPathWithinSourceRoot(filePath, this.policy.sourceRoot)
    if (candidatePath === undefined) return undefined
    const segments = splitPathSegments(candidatePath)
    const matches = collectModuleMatches(segments, this.policy.modules)
    return pickBestMatch(matches) ?? makeDefaultModule(candidatePath)
  }

  resolveImportTarget(importerFile: string, specifier: string): string | undefined {
    return this.projectContext.resolveLocalSpecifier(importerFile, specifier)
  }

  deriveProjectRoot(filePath: string): string | undefined {
    if (this.policy.sourceRoot === undefined) return undefined
    return deriveProjectRoot(filePath, this.policy.sourceRoot)
  }

  isPublicEntrypoint(filePath: string): boolean {
    return isPublicEntrypoint(filePath)
  }

  get sourceRoot(): string | undefined {
    return this.policy.sourceRoot
  }
}

function readArchitecturePolicy(context: Rule.RuleContext): ArchitecturePolicy | undefined {
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

function getPathWithinSourceRoot(pathValue: string, sourceRoot?: string): string | undefined {
  return applySourceRoot(normalizePath(pathValue), sourceRoot)
}

function deriveProjectRoot(filePath: string, sourceRoot: string): string | undefined {
  const normalized = normalizePath(filePath)
  const markerIndex = findSourceRootMarkerIndex(normalized, sourceRoot)
  if (markerIndex === -1) return undefined
  return normalized.slice(0, markerIndex)
}

function applySourceRoot(pathValue: string, sourceRoot?: string): string | undefined {
  if (sourceRoot === undefined) return pathValue
  const markerIndex = findSourceRootMarkerIndex(pathValue, sourceRoot)
  if (markerIndex === -1) return undefined
  return pathValue.slice(markerIndex + sourceRoot.length + 2)
}

function findSourceRootMarkerIndex(pathValue: string, sourceRoot: string): number {
  return pathValue.indexOf(`/${sourceRoot}/`)
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

function isPublicEntrypoint(filePath: string): boolean {
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
