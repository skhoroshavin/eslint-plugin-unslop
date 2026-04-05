import node_path from 'node:path'
import node_fs from 'node:fs'
import type { Rule } from 'eslint'
import {
  isPublicEntrypoint,
  readArchitecturePolicy,
  matchFileToArchitectureModule,
  normalizePath,
  resolveImportTarget,
} from '../../utils/index.js'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow shared files that are only used by one consumer',
      recommended: false,
    },
    schema: [],
    messages: {
      notTrulyShared: 'only used by: {{consumers}} -> Must be used by 2+ entities',
    },
  },
  create(context) {
    const filename = context.filename
    if (!filename) return {}

    const policy = readArchitecturePolicy(context)
    if (policy === undefined) return {}

    const matched = matchFileToArchitectureModule(filename, policy)
    if (matched === undefined) return {}
    if (!matched.policy.shared) return {}
    if (!isPublicEntrypoint(filename)) return {}

    const sourceRoot = policy.sourceRoot
    if (sourceRoot === undefined) return {}

    const projectRoot = deriveProjectRoot(filename, sourceRoot)
    if (projectRoot === undefined) return {}
    const sourceDir = node_path.join(projectRoot, sourceRoot)

    return {
      Program(node) {
        const consumers = findConsumers(filename, sourceDir)
        if (consumers !== undefined) {
          context.report({ node, messageId: 'notTrulyShared', data: { consumers } })
        }
      },
    }
  },
}

function deriveProjectRoot(filename: string, sourceRoot: string | undefined): string | undefined {
  const normalized = normalizePath(filename)
  if (sourceRoot === undefined) return undefined
  const marker = `/${sourceRoot}/`
  const index = normalized.indexOf(marker)
  if (index === -1) return undefined
  return normalized.slice(0, index)
}

function findConsumers(filename: string, sourceDir: string): string | undefined {
  const importers = findImporters(filename, sourceDir)
  const entities = new Set(importers.map((f) => getEntityName(f, sourceDir)))
  if (entities.size < 2) return [...entities].join(', ')
  return undefined
}

function getEntityName(importerPath: string, sourceDir: string): string {
  const rel = normalizePath(node_path.relative(sourceDir, importerPath))
  const parts = rel.split('/')
  if (parts.length <= 1) return rel
  return parts.slice(0, -1).join('/')
}

function findImporters(targetPath: string, sourceDir: string): string[] {
  const results: string[] = []
  scanDir(sourceDir, targetPath, results)
  return results
}

function scanDir(dir: string, targetPath: string, results: string[]): void {
  let entries: node_fs.Dirent[]
  try {
    entries = node_fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = node_path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDirEntry(entry, full, targetPath, results)
    } else {
      scanFileEntry(entry, full, targetPath, results)
    }
  }
}

function scanDirEntry(
  entry: node_fs.Dirent,
  full: string,
  targetPath: string,
  results: string[],
): void {
  if (entry.name === 'node_modules' || entry.name === '.git') return
  scanDir(full, targetPath, results)
}

function scanFileEntry(
  entry: node_fs.Dirent,
  full: string,
  targetPath: string,
  results: string[],
): void {
  if (!/\.[jt]sx?$/.test(entry.name)) return
  if (full === targetPath) return
  if (importsTarget(full, targetPath)) {
    results.push(full)
  }
}

function importsTarget(filePath: string, targetPath: string): boolean {
  let content: string
  try {
    content = node_fs.readFileSync(filePath, 'utf-8')
  } catch {
    return false
  }
  const importRe = /(?:import|from)\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = importRe.exec(content)) !== null) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    const resolved = resolveImportTarget(filePath, undefined, spec)
    if (resolved === targetPath) return true
    if (resolved !== undefined && importsTargetIndexFromDir(resolved, targetPath)) return true
  }
  return false
}

function importsTargetIndexFromDir(resolvedPath: string, targetPath: string): boolean {
  let stat: node_fs.Stats
  try {
    stat = node_fs.statSync(resolvedPath)
  } catch {
    return false
  }
  if (!stat.isDirectory()) return false
  if (!targetPath.startsWith(resolvedPath + node_path.sep)) return false
  return /^index\.[jt]sx?$/.test(node_path.basename(targetPath))
}

export default rule
