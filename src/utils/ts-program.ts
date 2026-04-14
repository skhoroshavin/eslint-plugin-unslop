import node_path from 'node:path'

import ts from 'typescript'

export function getRequiredTypeScriptProjectContext(
  filename: string,
): RequiredProjectContextResult {
  const normalizedFilename = normalizeResolvedPath(filename)
  const searchRoot = normalizeResolvedPath(node_path.dirname(filename))
  const tsconfigPath = ts.findConfigFile(searchRoot, ts.sys.fileExists, 'tsconfig.json')
  if (tsconfigPath === undefined) {
    return {
      kind: 'context-error',
      error: {
        reason: 'missing-tsconfig',
        filename: normalizedFilename,
        searchRoot,
      },
    }
  }

  const resolvedTsconfigPath = normalizeResolvedPath(tsconfigPath)
  const loadedContext = loadProjectContext(resolvedTsconfigPath)
  if (loadedContext.kind !== 'active') {
    return {
      kind: 'context-error',
      error: {
        reason: 'invalid-tsconfig',
        filename: normalizedFilename,
        searchRoot,
        tsconfigPath: resolvedTsconfigPath,
      },
    }
  }

  if (!isFileInProject(filename, loadedContext.projectContext)) {
    return {
      kind: 'context-error',
      error: {
        reason: 'file-not-in-project',
        filename: normalizedFilename,
        searchRoot,
        tsconfigPath: resolvedTsconfigPath,
        projectContext: loadedContext.projectContext,
      },
    }
  }

  return loadedContext
}

export function formatProjectContextError(error: ProjectContextError): string {
  const prefix = `TypeScript project context unavailable for "${error.filename}".`
  if (error.reason === 'missing-tsconfig') {
    return `${prefix} No tsconfig.json found while searching from "${error.searchRoot}".`
  }

  if (error.reason === 'invalid-tsconfig') {
    return `${prefix} Discovered tsconfig "${error.tsconfigPath}" could not be loaded.`
  }

  return `${prefix} Discovered tsconfig "${error.tsconfigPath}" does not include this file.`
}

function isFileInProject(filename: string, context: ProjectContext): boolean {
  return context.projectFiles.has(normalizeResolvedPath(filename))
}

export interface ProjectContext {
  projectRoot: string
  sourceRoot: string | undefined
  compilerOptions: ts.CompilerOptions
  moduleResolutionCache: ts.ModuleResolutionCache
  program: ts.Program
  checker: ts.TypeChecker
  projectFiles: Set<string>
}

type RequiredProjectContextResult =
  | { kind: 'active'; projectContext: ProjectContext }
  | { kind: 'context-error'; error: ProjectContextError }

export interface ProjectContextError {
  reason: 'missing-tsconfig' | 'invalid-tsconfig' | 'file-not-in-project'
  filename: string
  searchRoot: string
  tsconfigPath?: string
  projectContext?: ProjectContext
}

function loadProjectContext(tsconfigPath: string): LoadedProjectContext {
  const cached = projectContextCache.get(tsconfigPath)
  if (cached !== undefined) return cached

  const context = parseProjectContext(tsconfigPath)
  if (context === undefined) {
    const invalidResult: LoadedProjectContext = { kind: 'invalid-tsconfig' }
    projectContextCache.set(tsconfigPath, invalidResult)
    return invalidResult
  }

  const activeResult: LoadedProjectContext = { kind: 'active', projectContext: context }
  projectContextCache.set(tsconfigPath, activeResult)
  return activeResult
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

  return buildContext(projectRoot, parsed)
}

function buildContext(projectRoot: string, parsed: ts.ParsedCommandLine): ProjectContext {
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
    projectRoot,
    sourceRoot: deriveSourceRoot(parsed.options, projectRoot),
    compilerOptions: parsed.options,
    moduleResolutionCache,
    program,
    checker: program.getTypeChecker(),
    projectFiles: collectProjectFiles(program),
  }
}

function collectProjectFiles(program: ts.Program): Set<string> {
  const files = new Set<string>()
  for (const sourceFile of program.getSourceFiles()) {
    files.add(normalizeResolvedPath(sourceFile.fileName))
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
  const relative = normalizePath(node_path.relative(projectRoot, absolute))
  if (!isChildPath(projectRoot, absolute) || relative === '' || relative === '.') return undefined
  return trimSlashes(relative)
}

function isChildPath(parent: string, child: string): boolean {
  const normalizedParent = normalizeResolvedPath(parent)
  const normalizedChild = normalizeResolvedPath(child)
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}/`)
}

// --- private path helpers (local copies to avoid circular dependency with tsconfig-resolution) ---

function normalizeResolvedPath(filePath: string): string {
  return normalizePath(node_path.resolve(filePath))
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function getCanonicalFileName(pathValue: string): string {
  if (ts.sys.useCaseSensitiveFileNames) return pathValue
  return pathValue.toLowerCase()
}

const projectContextCache = new Map<string, LoadedProjectContext>()

type LoadedProjectContext =
  | { kind: 'active'; projectContext: ProjectContext }
  | { kind: 'invalid-tsconfig' }
