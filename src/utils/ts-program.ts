import node_path from 'node:path'

import ts from 'typescript'

export function getTypeScriptProjectContext(filename: string): ProjectContext | undefined {
  const tsconfigPath = ts.findConfigFile(
    node_path.dirname(filename),
    ts.sys.fileExists,
    'tsconfig.json',
  )
  if (tsconfigPath === undefined) return undefined

  const resolvedTsconfigPath = node_path.resolve(tsconfigPath)
  const cached = projectContextCache.get(resolvedTsconfigPath)
  if (cached !== undefined) return cached

  const context = parseProjectContext(resolvedTsconfigPath)
  if (context === undefined) return undefined
  projectContextCache.set(resolvedTsconfigPath, context)
  return context
}

export function isFileInProject(filename: string, context: ProjectContext): boolean {
  return context.projectFiles.has(resolveNormalized(filename))
}

function parseProjectContext(tsconfigPath: string): ProjectContext | undefined {
  const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (readResult.error !== undefined) return undefined

  const projectRoot = node_path.dirname(tsconfigPath)
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    projectRoot,
    undefined,
    tsconfigPath,
  )
  if (parsed.errors.length > 0) return undefined

  return buildContext(tsconfigPath, projectRoot, parsed)
}

function buildContext(
  tsconfigPath: string,
  projectRoot: string,
  parsed: ts.ParsedCommandLine,
): ProjectContext {
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  })
  const moduleResolutionCache = ts.createModuleResolutionCache(
    projectRoot,
    getCanonicalFileName,
    parsed.options,
  )

  return {
    tsconfigPath,
    projectRoot,
    sourceRoot: deriveSourceRoot(parsed.options, projectRoot),
    compilerOptions: parsed.options,
    parsedCommandLine: parsed,
    moduleResolutionCache,
    program,
    checker: program.getTypeChecker(),
    projectFiles: collectProjectFiles(program),
  }
}

function collectProjectFiles(program: ts.Program): Set<string> {
  const files = new Set<string>()
  for (const sourceFile of program.getSourceFiles()) {
    files.add(resolveNormalized(sourceFile.fileName))
  }
  return files
}

function deriveSourceRoot(
  compilerOptions: ts.CompilerOptions,
  projectRoot: string,
): string | undefined {
  const rootDir = normalizeSourceRootCandidate(compilerOptions.rootDir, projectRoot)
  if (rootDir !== undefined) return rootDir

  const pathsRoot = inferSourceRootFromPaths(compilerOptions.paths, projectRoot)
  if (pathsRoot !== undefined) return pathsRoot

  return normalizeSourceRootCandidate(compilerOptions.baseUrl, projectRoot)
}

function inferSourceRootFromPaths(
  paths: Record<string, readonly string[]> | undefined,
  projectRoot: string,
): string | undefined {
  if (paths === undefined) return undefined
  for (const targets of Object.values(paths)) {
    if (targets.length === 0) continue
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
  const relative = forwardSlashes(node_path.relative(projectRoot, absolute))
  if (!isChildPath(projectRoot, absolute) || relative === '' || relative === '.') return undefined
  return trimEdgeSlashes(relative)
}

// --- private path helpers (local copies to avoid circular dependency with tsconfig-resolution) ---

function resolveNormalized(filePath: string): string {
  return forwardSlashes(node_path.resolve(filePath))
}

function forwardSlashes(value: string): string {
  return value.replace(/\\/g, '/')
}

function isChildPath(parent: string, child: string): boolean {
  const normalizedParent = resolveNormalized(parent)
  const normalizedChild = resolveNormalized(child)
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}/`)
}

function trimEdgeSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function getCanonicalFileName(pathValue: string): string {
  if (ts.sys.useCaseSensitiveFileNames) return pathValue
  return pathValue.toLowerCase()
}

export interface ProjectContext {
  tsconfigPath: string
  projectRoot: string
  sourceRoot: string | undefined
  compilerOptions: ts.CompilerOptions
  parsedCommandLine: ts.ParsedCommandLine
  moduleResolutionCache: ts.ModuleResolutionCache
  program: ts.Program
  checker: ts.TypeChecker
  projectFiles: Set<string>
}

const projectContextCache = new Map<string, ProjectContext>()
