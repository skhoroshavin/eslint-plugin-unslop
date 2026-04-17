import node_fs from 'node:fs'
import node_os from 'node:os'
import node_path from 'node:path'

import { afterEach, expect, test } from 'vitest'
import ts from 'typescript'

import {
  createArchitecturePolicy,
  getCanonicalModulePath,
  matchFileToArchitectureModule,
} from '../src/utils/architecture-policy.js'

const tempDirs: string[] = []

afterEach(() => {
  const dirs = tempDirs.splice(0)
  for (const dir of dirs) {
    node_fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('canonical module path resolves to the containing directory', () => {
  const project = createProject({
    'tsconfig.json': '{"compilerOptions":{"rootDir":"./src"}}',
    'src/models/a/index.ts': 'export const value = 1',
    'src/models/a/internal/x.ts': 'export const value = 1',
    'src/index.ts': 'export const value = 1',
  })

  expect(getCanonicalModulePath(project.file('src/models/a/index.ts'), project.context)).toBe(
    'models/a',
  )
  expect(getCanonicalModulePath(project.file('src/models/a/internal/x.ts'), project.context)).toBe(
    'models/a/internal',
  )
  expect(getCanonicalModulePath(project.file('src/index.ts'), project.context)).toBe('.')
})

test('nearest owning selector wins by subtree precedence', () => {
  const project = createProject({
    'tsconfig.json': '{"compilerOptions":{"rootDir":"./src"}}',
    'src/models/a/internal/x.ts': 'export const value = 1',
    'src/models/b/index.ts': 'export const value = 1',
  })

  const policy = getActivePolicy(
    {
      models: { imports: ['root'] },
      'models/*': { imports: ['child'] },
      'models/a': { imports: ['exact-child'] },
    },
    project.context,
  )

  expect(
    matchFileToArchitectureModule(project.file('src/models/a/internal/x.ts'), policy),
  ).toMatchObject({
    canonicalPath: 'models/a/internal',
    ownerKey: 'models/a',
    ownerPath: 'models/a',
    anonymous: false,
    policy: { imports: ['exact-child'] },
  })

  expect(
    matchFileToArchitectureModule(project.file('src/models/b/index.ts'), policy),
  ).toMatchObject({
    canonicalPath: 'models/b',
    ownerKey: 'models/*',
    ownerPath: 'models/b',
    anonymous: false,
    policy: { imports: ['child'] },
  })
})

test('unsupported and file-shaped architecture keys return a shared config error', () => {
  const project = createProject({
    'tsconfig.json': '{"compilerOptions":{"rootDir":"./src"}}',
    'src/index.ts': 'export const value = 1',
  })

  expect(createArchitecturePolicy({ 'rules/public.ts': { imports: [] } }, project.context)).toEqual(
    {
      kind: 'config-error',
      details:
        'unsupported architecture key selector "rules/public.ts". Use ".", directory-shaped selectors like "models", or terminal child selectors like "models/*".',
    },
  )

  expect(createArchitecturePolicy({ 'models/+': { imports: [] } }, project.context)).toEqual({
    kind: 'config-error',
    details:
      'unsupported architecture key selector "models/+". Use ".", directory-shaped selectors like "models", or terminal child selectors like "models/*".',
  })
})

test('unmatched canonical paths become anonymous modules with default policy', () => {
  const project = createProject({
    'tsconfig.json': '{"compilerOptions":{"rootDir":"./src"}}',
    'src/unknown/public/index.ts': 'export const value = 1',
  })

  const policy = getActivePolicy({}, project.context)
  expect(
    matchFileToArchitectureModule(project.file('src/unknown/public/index.ts'), policy),
  ).toEqual({
    canonicalPath: 'unknown/public',
    ownerKey: 'unknown/public',
    ownerPath: 'unknown/public',
    anonymous: true,
    order: 0,
    ownerDepth: 2,
    isExact: true,
    keyDepth: 2,
    policy: { imports: [], typeImports: [], exports: [], entrypoints: ['index.ts'], shared: false },
  })
})

function createProject(files: Record<string, string>): TestProject {
  const dir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), 'unslop-architecture-policy-'))
  tempDirs.push(dir)

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = node_path.join(dir, relativePath)
    node_fs.mkdirSync(node_path.dirname(fullPath), { recursive: true })
    node_fs.writeFileSync(fullPath, content)
  }

  const configPath = node_path.join(dir, 'tsconfig.json')
  const parsed = readParsedTsconfig(configPath)

  if (parsed === undefined) {
    throw new Error(`Failed to parse tsconfig at ${configPath}`)
  }

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  })

  return {
    context: {
      projectRoot: dir,
      sourceRoot: 'src',
      compilerOptions: parsed.options,
      moduleResolutionCache: ts.createModuleResolutionCache(dir, (value) => value, parsed.options),
      program,
      checker: program.getTypeChecker(),
      projectFiles: new Set(
        program.getSourceFiles().map((sourceFile) => normalizeFile(sourceFile.fileName)),
      ),
    },
    file(relativePath) {
      return node_path.join(dir, relativePath)
    },
  }
}

function getActivePolicy(architecture: Record<string, unknown>, context: TestProject['context']) {
  const result = createArchitecturePolicy(architecture, context)
  if (result.kind === 'active') return result.policy
  throw new Error(`Expected active policy, got ${result.kind}`)
}

function normalizeFile(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function readParsedTsconfig(configPath: string): ts.ParsedCommandLine | undefined {
  return ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic() {},
  })
}

interface TestProject {
  context: {
    projectRoot: string
    sourceRoot: string | undefined
    compilerOptions: ts.CompilerOptions
    moduleResolutionCache: ts.ModuleResolutionCache
    program: ts.Program
    checker: ts.TypeChecker
    projectFiles: Set<string>
  }
  file(relativePath: string): string
}
