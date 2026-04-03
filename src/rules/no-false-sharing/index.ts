import node_path from 'node:path'
import node_fs from 'node:fs'
import type { Rule } from 'eslint'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow shared files that are only used by one consumer',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          dirs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                mode: { enum: ['file', 'dir'] },
              },
              required: ['path'],
              additionalProperties: false,
            },
          },
        },
        required: ['dirs'],
        additionalProperties: false,
      },
    ],
    messages: {
      notTrulyShared: 'only used by: {{consumers}} -> Must be used by 2+ entities',
    },
  },
  create(context) {
    const filename = context.filename
    if (!filename) return {}

    const dirs = getConfigDirs(context.options[0])
    if (dirs.length === 0) return {}

    const posixFilename = toPosix(filename)
    const matchedDir = findMatchingDir(posixFilename, dirs)
    if (!matchedDir) return {}

    const projectRoot = findProjectRoot(filename, matchedDir.path)
    if (!projectRoot) return {}

    return {
      Program(node) {
        const consumers = findConsumers(filename, projectRoot, matchedDir)
        if (consumers !== undefined) {
          context.report({ node, messageId: 'notTrulyShared', data: { consumers } })
        }
      },
    }
  },
}

interface DirConfig {
  path: string
  mode?: 'file' | 'dir'
}

function findConsumers(
  filename: string,
  projectRoot: string,
  matchedDir: DirConfig,
): string | undefined {
  const importers = findImporters(filename, projectRoot)
  const nonTestImporters = importers.filter((f) => !isTestFile(f))
  const mode = matchedDir.mode ?? 'dir'
  const entities = new Set(nonTestImporters.map((f) => getEntityName(f, projectRoot, mode)))
  if (entities.size < 2) return [...entities].join(', ')
  return undefined
}

function getConfigDirs(option: unknown): DirConfig[] {
  if (typeof option !== 'object' || option === null) return []
  if (!('dirs' in option)) return []
  const dirs = option.dirs
  if (!Array.isArray(dirs)) return []
  return dirs
}

function isTestFile(filePath: string): boolean {
  return /\.test\.[jt]sx?$/.test(filePath)
}

function findImporters(targetPath: string, projectRoot: string): string[] {
  const results: string[] = []
  scanDir(projectRoot, targetPath, results)
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
  const fileDir = node_path.dirname(filePath)
  while ((m = importRe.exec(content)) !== null) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    const resolved = resolveImportTarget(fileDir, spec)
    if (resolved === targetPath) return true
  }
  return false
}

function resolveImportTarget(fromDir: string, spec: string): string | null {
  const base = node_path.resolve(fromDir, spec)
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx']
  for (const ext of extensions) {
    const candidate = base + ext
    if (node_fs.existsSync(candidate)) return candidate
  }
  const indexExtensions = ['.ts', '.tsx', '.js', '.jsx']
  for (const ext of indexExtensions) {
    const candidate = node_path.join(base, 'index' + ext)
    if (node_fs.existsSync(candidate)) return candidate
  }
  return null
}

function getEntityName(importerPath: string, projectRoot: string, mode: string): string {
  const rel = toPosix(node_path.relative(projectRoot, importerPath))
  if (mode === 'dir') {
    const parts = rel.split('/')
    return parts[0]
  }
  return rel
}

function findMatchingDir(posixFilename: string, dirs: DirConfig[]): DirConfig | undefined {
  for (const dir of dirs) {
    const dirSegment = '/' + dir.path + '/'
    if (posixFilename.includes(dirSegment)) return dir
  }
  return undefined
}

function findProjectRoot(filename: string, sharedDirName: string): string | undefined {
  const posix = toPosix(filename)
  const idx = posix.lastIndexOf('/' + sharedDirName + '/')
  if (idx === -1) return undefined
  return posix.slice(0, idx)
}

function toPosix(p: string): string {
  return p.split(node_path.sep).join('/')
}

export default rule
