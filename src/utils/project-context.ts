import node_fs from 'node:fs'
import node_path from 'node:path'

import { Project, ts } from 'ts-morph'

import type { ImportDeclaration, SourceFile } from 'ts-morph'

export class ProjectContext {
  private constructor(
    private readonly project: Project,
    private readonly options: InternalProjectContextOptions,
  ) {}

  static forFile(filePath: string, options: ProjectContextOptions): ProjectContext {
    const tsconfigPath = findNearestTsconfig(filePath)
    const cacheKey = makeCacheKey(tsconfigPath, options)
    const cached = PROJECT_CONTEXTS.get(cacheKey)
    if (cached !== undefined) return cached
    const context = new ProjectContext(createProject(tsconfigPath), {
      sourceRoot: options.sourceRoot,
      projectRoot: options.projectRoot,
      tsconfigPath,
    })
    PROJECT_CONTEXTS.set(cacheKey, context)
    return context
  }

  resolveLocalSpecifier(importerFile: string, specifier: string): string | undefined {
    if (!isLocalSpecifier(specifier)) return undefined
    if (this.hasProjectConfig) {
      return this.resolveWithProject(importerFile, specifier)
    }
    return resolveWithFallback(importerFile, specifier, this.options)
  }

  listSourceFiles(sourceDir: string): readonly string[] {
    if (this.hasProjectConfig) return this.listProjectSourceFiles(sourceDir)
    return this.listFallbackSourceFiles(sourceDir)
  }

  get hasProjectConfig(): boolean {
    return this.options.tsconfigPath !== undefined
  }

  getSourceFile(filePath: string): SourceFile | undefined {
    return this.getOrAddSourceFile(filePath)
  }

  getImportDeclarations(filePath: string): readonly ImportDeclaration[] {
    const sourceFile = this.getOrAddSourceFile(filePath)
    return sourceFile?.getImportDeclarations() ?? []
  }

  private resolveWithProject(importerFile: string, specifier: string): string | undefined {
    const resolved = ts.resolveModuleName(
      specifier,
      importerFile,
      this.project.getCompilerOptions(),
      ts.sys,
    ).resolvedModule
    if (resolved === undefined) return undefined
    return this.ensureInsideSourceRoot(resolved.resolvedFileName)
  }

  private listProjectSourceFiles(sourceDir: string): readonly string[] {
    const sourceRoot = normalizePath(sourceDir)
    return this.project
      .getSourceFiles()
      .map((sourceFile) => normalizePath(sourceFile.getFilePath()))
      .filter((filePath) => isSourceFile(filePath) && isInsidePath(filePath, sourceRoot))
  }

  private listFallbackSourceFiles(sourceDir: string): readonly string[] {
    const sourceFiles = collectSourceFiles(sourceDir)
    for (const filePath of sourceFiles) {
      this.project.addSourceFileAtPathIfExists(filePath)
    }
    return sourceFiles.map((filePath) => normalizePath(filePath))
  }

  private getOrAddSourceFile(filePath: string): SourceFile | undefined {
    const sourceFilePath = normalizePath(filePath)
    return (
      this.project.getSourceFile(sourceFilePath) ??
      this.project.getSourceFile(filePath) ??
      this.project.addSourceFileAtPathIfExists(filePath)
    )
  }

  private ensureInsideSourceRoot(filePath: string): string | undefined {
    if (this.options.sourceRoot === undefined) return filePath
    const normalized = normalizePath(filePath)
    return hasSourceRootSegment(normalized, this.options.sourceRoot) ? filePath : undefined
  }
}

interface ProjectContextOptions {
  sourceRoot?: string
  projectRoot?: string
}

interface InternalProjectContextOptions extends ProjectContextOptions {
  tsconfigPath?: string
}

const PROJECT_CONTEXTS = new Map<string, ProjectContext>()

function makeCacheKey(tsconfigPath: string | undefined, options: ProjectContextOptions): string {
  const sourceRoot = options.sourceRoot ?? ''
  const projectRoot = options.projectRoot ?? ''
  return `${tsconfigPath ?? '__no_tsconfig__'}::${projectRoot}::${sourceRoot}`
}

function createProject(tsconfigPath: string | undefined): Project {
  if (tsconfigPath !== undefined) {
    return new Project({ tsConfigFilePath: tsconfigPath })
  }
  return new Project({
    skipFileDependencyResolution: true,
    skipLoadingLibFiles: true,
  })
}

function resolveWithFallback(
  importerFile: string,
  specifier: string,
  options: ProjectContextOptions,
): string | undefined {
  if (specifier.startsWith('@/')) {
    return resolveAliasImport(specifier, options)
  }
  const importerDir = node_path.dirname(importerFile)
  const base = node_path.resolve(importerDir, specifier)
  return resolveInsideSourceRoot(resolveExistingFile(base), options.sourceRoot)
}

function resolveAliasImport(specifier: string, options: ProjectContextOptions): string | undefined {
  if (options.sourceRoot === undefined || options.projectRoot === undefined) return undefined
  const remainder = specifier.slice(2)
  const base = node_path.join(options.projectRoot, options.sourceRoot, remainder)
  return resolveInsideSourceRoot(resolveExistingFile(base), options.sourceRoot)
}

function resolveInsideSourceRoot(
  filePath: string | undefined,
  sourceRoot: string | undefined,
): string | undefined {
  if (filePath === undefined || sourceRoot === undefined) return filePath
  const normalized = normalizePath(filePath)
  return hasSourceRootSegment(normalized, sourceRoot) ? filePath : undefined
}

function hasSourceRootSegment(pathValue: string, sourceRoot: string): boolean {
  return pathValue.includes(`/${sourceRoot}/`)
}

function findNearestTsconfig(filePath: string): string | undefined {
  let directory = node_path.dirname(filePath)
  while (true) {
    const candidate = node_path.join(directory, 'tsconfig.json')
    if (isFile(candidate)) return candidate
    const parent = node_path.dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

function isFile(filePath: string): boolean {
  try {
    return node_fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function collectSourceFiles(sourceDir: string): string[] {
  const result: string[] = []
  collectSourceFilesRecursive(sourceDir, result)
  return result
}

function collectSourceFilesRecursive(directoryPath: string, files: string[]): void {
  for (const entry of readDirectoryEntries(directoryPath)) {
    const fullPath = node_path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue
      collectSourceFilesRecursive(fullPath, files)
      continue
    }
    if (entry.isFile() && isSourceFile(fullPath)) {
      files.push(fullPath)
    }
  }
}

function readDirectoryEntries(directoryPath: string): readonly node_fs.Dirent[] {
  try {
    return node_fs.readdirSync(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }
}

function resolveExistingFile(basePath: string): string | undefined {
  for (const candidate of buildCandidates(basePath)) {
    const resolved = resolveCandidate(candidate)
    if (resolved !== undefined) return resolved
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
    const replacement = extension === '.jsx' ? '.tsx' : '.ts'
    candidates.push(basePath.slice(0, -extension.length) + replacement)
  }
  return candidates
}

function resolveCandidate(candidate: string): string | undefined {
  if (!node_fs.existsSync(candidate)) return undefined
  const stat = node_fs.statSync(candidate)
  if (stat.isFile()) return candidate
  if (!stat.isDirectory()) return undefined
  for (const extension of FILE_EXTENSIONS.slice(1)) {
    const indexPath = node_path.join(candidate, `index${extension}`)
    if (!isFile(indexPath)) continue
    return indexPath
  }
  return undefined
}

function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/')
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_FILE_PATTERN.test(filePath)
}

function isInsidePath(filePath: string, rootPath: string): boolean {
  return filePath === rootPath || filePath.startsWith(`${rootPath}/`)
}

const SKIPPED_DIRS = new Set(['node_modules', '.git'])

const SOURCE_FILE_PATTERN = /\.[jt]sx?$/

const JS_IMPORT_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs']

const FILE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

export function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, '/').split(node_path.sep).join('/')
}
