/**
 * Single shared test utility for all rule tests.
 *
 * Exports exactly ONE thing: scenario()
 *
 * Do NOT add exports. If you think you need a second export,
 * update the Testing Conventions section in AGENTS.md first.
 */
import node_fs from 'node:fs'
import node_os from 'node:os'
import node_path from 'node:path'
import { test } from 'vitest'
import parser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import type { Rule } from 'eslint'

type ScenarioArchitecture = Record<string, ArchitectureModulePolicy>

interface ArchitectureModulePolicy {
  imports?: string[]
  typeImports?: string[]
  exports?: string[]
  entrypoints?: string[]
  shared?: boolean
}

export function scenario(
  description: string,
  rule: Rule.RuleModule,
  options: ScenarioOptions,
): void {
  test(description, () => {
    if (isFullScenario(options)) {
      runWithTempDir(rule, options)
    } else {
      runInMemory(rule, options)
    }
  })
}

scenario.todo = (description: string): void => {
  test.todo(description)
}

function runInMemory(rule: Rule.RuleModule, options: SimpleScenario): void {
  const tester = makeTester(options)
  runTester(tester, rule, options, options.filename)
}

function runWithTempDir(rule: Rule.RuleModule, options: FullScenario): void {
  const dir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), 'unslop-test-'))
  try {
    writeScenarioFiles(dir, options)
    const filename = getScenarioFilename(dir, options.filename)
    const hasTsconfig = hasTsconfigFile(options)
    const tester = hasTsconfig ? makeFsTester(options, dir) : makeTester(options)
    const code = getFullScenarioTargetContent(options)
    runTester(tester, rule, { ...options, code }, filename)
  } finally {
    node_fs.rmSync(dir, { recursive: true, force: true })
  }
}

function writeScenarioFiles(dir: string, options: FullScenario): void {
  for (const file of options.files) {
    const full = node_path.join(dir, file.path)
    node_fs.mkdirSync(node_path.dirname(full), { recursive: true })
    node_fs.writeFileSync(full, getScenarioFileContent(file, options))
  }
}

function getScenarioFileContent(file: ScenarioFile, options: FullScenario): string {
  if (file.path === options.filename) {
    return getFullScenarioTargetContent(options)
  }
  return file.content ?? ''
}

function getScenarioFilename(dir: string, filename: string | undefined): string | undefined {
  return filename !== undefined ? node_path.join(dir, filename) : undefined
}

function hasTsconfigFile(options: FullScenario): boolean {
  return options.files.some((file) => file.path === 'tsconfig.json')
}

function makeTester(options: ScenarioOptions): RuleTester {
  const config: Record<string, unknown> = {
    languageOptions:
      options.typescript === true
        ? { parser, ecmaVersion: 'latest', sourceType: 'module' }
        : { ecmaVersion: 'latest', sourceType: 'module' },
    settings: makeRuleTesterSettings(options.architecture),
  }
  return new RuleTester(config)
}

function makeFsTester(options: ScenarioOptions, dir: string): RuleTester {
  const config: Record<string, unknown> = {
    languageOptions: {
      parser,
      parserOptions: {
        project: node_path.join(dir, 'tsconfig.json'),
        tsconfigRootDir: dir,
      },
    },
    settings: makeRuleTesterSettings(options.architecture),
  }
  return new RuleTester(config)
}

function makeRuleTesterSettings(architecture: ScenarioArchitecture | undefined): {
  unslop: { architecture?: ScenarioArchitecture }
} {
  return architecture !== undefined ? { unslop: { architecture } } : { unslop: {} }
}

function runTester(
  tester: RuleTester,
  rule: Rule.RuleModule,
  options: ScenarioBase & { code: string; filename?: string },
  filename: string | undefined,
): void {
  const base = {
    code: options.code,
    ...(filename !== undefined && { filename }),
  }

  if (options.errors !== undefined) {
    const invalidCase = {
      ...base,
      errors: options.errors,
      ...(options.output !== undefined && { output: options.output }),
    }
    tester.run('rule', rule, { valid: [], invalid: [invalidCase] })
  } else {
    tester.run('rule', rule, { valid: [base], invalid: [] })
  }
}

interface SimpleScenario extends ScenarioBase {
  code: string
  files?: never
  filename?: string
}

interface FullScenario extends ScenarioBase {
  files: ScenarioFile[]
  filename: string
  code?: never
}

type ScenarioOptions = SimpleScenario | FullScenario

interface ScenarioBase {
  typescript?: boolean
  architecture?: ScenarioArchitecture
  errors?: RuleTester.InvalidTestCase['errors']
  output?: string | null
}

function isFullScenario(options: ScenarioOptions): options is FullScenario {
  return options.files !== undefined
}

interface ScenarioFile {
  path: string
  content?: string
}

function getFullScenarioTargetContent(options: FullScenario): string {
  const target = options.files.find((file) => file.path === options.filename)

  if (target === undefined) {
    throw new Error(
      `Full scenario setup error: no file fixture matches filename "${options.filename}". Add a files entry with this path and explicit content.`,
    )
  }

  if (target.content === undefined) {
    throw new Error(
      `Full scenario setup error: file fixture "${options.filename}" is missing content. Full scenarios require explicit target content.`,
    )
  }

  return target.content
}
