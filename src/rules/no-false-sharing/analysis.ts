import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { isInsidePath, toPosix } from '../../utils/path-helpers.js'
import type { DirEntry, SharingMode } from '../../utils/rule-options.js'

export function runConsumerCheck(
  program: ts.Program,
  projectRoot: string,
  sourceRoot: string,
  directories: DirEntry[],
): Map<string, string[]> {
  const cacheKey = `${sourceRoot}\0${directories.map((d) => `${d.path}:${d.mode}`).join('\0')}`
  const cached = readCache(program, cacheKey)
  if (cached) {
    return cached
  }

  const checker = program.getTypeChecker()
  const sourceFiles = program.getSourceFiles().filter((sf) => isInsidePath(sf.fileName, sourceRoot))

  const modules = indexModules(directories, projectRoot, sourceRoot)
  const barrels = indexBarrels(directories, projectRoot, sourceFiles, checker)
  const ctx: AnalysisContext = { modules, barrels, checker }
  countConsumers(sourceFiles, sourceRoot, ctx)
  const errors = collectErrors(modules)

  writeCache(program, cacheKey, errors)
  return errors
}

function indexModules(
  directories: DirEntry[],
  projectRoot: string,
  sourceRoot: string,
): Map<string, ModuleEntry> {
  const modules = new Map<string, ModuleEntry>()

  for (const dir of directories) {
    const absDir = path.join(projectRoot, dir.path)
    for (const file of listModuleFiles(absDir)) {
      modules.set(file, {
        relativePath: toPosix(path.relative(sourceRoot, file)),
        mode: dir.mode,
        consumers: new Set(),
      })
    }
  }

  return modules
}

function listModuleFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return []
  }

  return readdirSync(directory, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) &&
        e.name !== 'index.ts' &&
        !isTestFile(e.name),
    )
    .map((e) => path.join(directory, e.name))
}

function indexBarrels(
  directories: DirEntry[],
  projectRoot: string,
  sourceFiles: ts.SourceFile[],
  checker: ts.TypeChecker,
): Map<string, Map<string, string>> {
  const barrels = new Map<string, Map<string, string>>()
  const sfByPath = new Map(sourceFiles.map((sf) => [sf.fileName, sf]))

  for (const dir of directories) {
    const barrelPath = path.join(projectRoot, dir.path, 'index.ts')
    const barrelSf = sfByPath.get(barrelPath)
    if (barrelSf) {
      barrels.set(barrelPath, buildBarrelMap(barrelSf, checker))
    }
  }

  return barrels
}

function buildBarrelMap(barrelFile: ts.SourceFile, checker: ts.TypeChecker): Map<string, string> {
  const map = new Map<string, string>()

  for (const stmt of barrelFile.statements) {
    if (!isNamedReExport(stmt)) continue

    const targetPath = resolveModulePath(stmt.moduleSpecifier, checker)
    if (!targetPath) continue

    for (const el of stmt.exportClause.elements) {
      if (!el.isTypeOnly) {
        map.set(el.name.text, targetPath)
      }
    }
  }

  return map
}

function isNamedReExport(
  stmt: ts.Statement,
): stmt is ts.ExportDeclaration & {
  exportClause: ts.NamedExports
  moduleSpecifier: ts.Expression
} {
  return (
    ts.isExportDeclaration(stmt) &&
    !stmt.isTypeOnly &&
    !!stmt.moduleSpecifier &&
    !!stmt.exportClause &&
    ts.isNamedExports(stmt.exportClause)
  )
}

function countConsumers(
  sourceFiles: ts.SourceFile[],
  sourceRoot: string,
  ctx: AnalysisContext,
): void {
  for (const sf of sourceFiles) {
    if (ctx.modules.has(sf.fileName) || isTestFile(sf.fileName)) continue

    const consumerPath = toPosix(path.relative(sourceRoot, sf.fileName))

    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt)) {
        recordImport(stmt, consumerPath, ctx)
      }
    }
  }
}

function isTestFile(filePath: string): boolean {
  return TEST_FILE_RE.test(filePath)
}

const TEST_FILE_RE = /\.(test|integration-test|test-suite)\.ts$/

function recordImport(
  stmt: ts.ImportDeclaration,
  consumerPath: string,
  ctx: AnalysisContext,
): void {
  const targetPath = resolveModulePath(stmt.moduleSpecifier, ctx.checker)
  if (!targetPath) return

  const direct = ctx.modules.get(targetPath)
  if (direct) {
    direct.consumers.add(deriveEntity(consumerPath, direct.mode))
    return
  }

  const barrelMap = ctx.barrels.get(targetPath)
  if (barrelMap) {
    resolveBarrelImports(stmt, barrelMap, consumerPath, ctx.modules)
  }
}

function resolveBarrelImports(
  stmt: ts.ImportDeclaration,
  barrelMap: Map<string, string>,
  consumerPath: string,
  modules: Map<string, ModuleEntry>,
): void {
  const bindings = stmt.importClause?.namedBindings
  if (!bindings) return

  const paths = ts.isNamespaceImport(bindings)
    ? [...barrelMap.values()]
    : resolveNamedImports(bindings, barrelMap)

  for (const resolved of paths) {
    const entry = modules.get(resolved)
    entry?.consumers.add(deriveEntity(consumerPath, entry.mode))
  }
}

function resolveNamedImports(bindings: ts.NamedImports, barrelMap: Map<string, string>): string[] {
  const result: string[] = []
  for (const el of bindings.elements) {
    const name = el.propertyName?.text ?? el.name.text
    const resolved = barrelMap.get(name)
    if (resolved) {
      result.push(resolved)
    }
  }
  return result
}

function resolveModulePath(specifier: ts.Expression, checker: ts.TypeChecker): string | undefined {
  const symbol = checker.getSymbolAtLocation(specifier)
  return symbol?.declarations?.[0]?.getSourceFile().fileName
}

function collectErrors(modules: Map<string, ModuleEntry>): Map<string, string[]> {
  const errors = new Map<string, string[]>()

  for (const [, entry] of modules) {
    if (entry.consumers.size >= 2) continue

    const consumers = [...entry.consumers]
    const description =
      consumers.length === 0
        ? 'not imported by any entity'
        : `only used by: ${consumers.join(', ')}`

    errors.set(entry.relativePath, [`${description} -> Must be used by 2+ entities`])
  }

  return errors
}

function deriveEntity(consumerPath: string, mode: SharingMode): string {
  if (mode === 'file') {
    return consumerPath
  }
  return consumerPath.split('/').slice(0, -1).slice(0, MAX_DIR_DEPTH).join('/')
}

const MAX_DIR_DEPTH = 3

function readCache(program: ts.Program, key: string): Map<string, string[]> | undefined {
  return analysisCache.get(program)?.get(key)
}

function writeCache(program: ts.Program, key: string, errors: Map<string, string[]>): void {
  let programCache = analysisCache.get(program)
  if (!programCache) {
    programCache = new Map()
    analysisCache.set(program, programCache)
  }
  programCache.set(key, errors)
}

const analysisCache = new WeakMap<ts.Program, Map<string, Map<string, string[]>>>()

interface AnalysisContext {
  modules: Map<string, ModuleEntry>
  barrels: Map<string, Map<string, string>>
  checker: ts.TypeChecker
}

interface ModuleEntry {
  relativePath: string
  mode: SharingMode
  consumers: Set<string>
}
