import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.join(import.meta.dirname, '..')
const BUMP_ARGS = ['major', 'minor', 'patch'] as const
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/
const PKG_PATH = path.join(ROOT, 'package.json')
const LOCK_PATH = path.join(ROOT, 'package-lock.json')

if (import.meta.url === `file://${process.argv[1]}`) main()

function main() {
  const args = process.argv.slice(2)
  const validCommands: Set<string> = new Set(BUMP_ARGS)
  const isBumpArg = (s: string): s is BumpArg => validCommands.has(s)
  const command = args.find(isBumpArg)
  const noGit = args.includes('--no-git')

  if (!command) {
    throw new Error(`Missing command. Valid: ${BUMP_ARGS.join(', ')}`)
  }

  if (args.some((a) => a !== command && a !== '--no-git')) {
    throw new Error(`Unknown argument. Valid: ${BUMP_ARGS.join(', ')}, --no-git`)
  }

  if (!noGit) {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim()
    if (status) throw new Error('Working tree is not clean. Commit or stash changes first.')
  }

  const pkgRaw: unknown = JSON.parse(readFileSync(PKG_PATH, 'utf8'))
  if (!isPackageJson(pkgRaw)) throw new Error('Invalid package.json')
  const currentVersion = pkgRaw.version
  const parsed = parseVersion(currentVersion)
  const next = computeNext(parsed, command)
  const nextString = formatVersion(next)

  bumpFiles(pkgRaw, nextString)

  if (noGit) {
    process.stdout.write(nextString)
    return
  }

  execSync('git add package.json package-lock.json', { cwd: ROOT, stdio: 'inherit' })
  execSync(`git commit -m "Bump version to ${nextString}"`, { cwd: ROOT, stdio: 'inherit' })

  console.log(`\nBumped ${currentVersion} → ${nextString}`)
}

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

export function parseVersion(version: string): ParsedVersion {
  const m = VERSION_RE.exec(version)
  if (!m) throw new Error(`Invalid version (expected MAJOR.MINOR.PATCH): ${version}`)
  const [, major, minor, patch] = m
  return { major: Number(major), minor: Number(minor), patch: Number(patch) }
}

export function computeNext(current: ParsedVersion, command: BumpArg): ParsedVersion {
  switch (command) {
    case 'major':
      return { major: current.major + 1, minor: 0, patch: 0 }
    case 'minor':
      return { ...current, minor: current.minor + 1, patch: 0 }
    case 'patch':
      return { ...current, patch: current.patch + 1 }
  }
}

export function formatVersion(v: ParsedVersion): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

function bumpFiles(pkg: PackageJson, nextVersion: string): void {
  pkg.version = nextVersion
  writeFileSync(PKG_PATH, JSON.stringify(pkg, undefined, 2) + '\n')

  const lockRaw: unknown = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
  if (!isPackageJson(lockRaw)) throw new Error('Invalid package-lock.json')
  const lock = lockRaw
  lock.version = nextVersion
  if (lock.packages?.['']?.version) {
    lock.packages[''].version = nextVersion
  }
  writeFileSync(LOCK_PATH, JSON.stringify(lock, undefined, 2) + '\n')
}

type BumpArg = (typeof BUMP_ARGS)[number]

function isPackageJson(value: unknown): value is PackageJson {
  if (!isRecord(value)) return false
  if (typeof value.version !== 'string') return false
  if (value.packages === undefined) return true
  if (!isRecord(value.packages)) return false
  return Object.values(value.packages).every(isPackageEntry)
}

function isPackageEntry(value: unknown): value is { version?: string } {
  if (!isRecord(value)) return false
  return value.version === undefined || typeof value.version === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

interface PackageJson {
  version: string
  packages?: Record<string, { version?: string }>
  [key: string]: unknown
}
