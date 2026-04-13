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

export function scenario(
  description: string,
  rule: Rule.RuleModule,
  options: ScenarioOptions,
): void {
  test(description, () => {
    if (options.files !== undefined) {
      runWithTempDir(rule, options)
    } else {
      runInMemory(rule, options)
    }
  })
}

scenario.todo = (description: string): void => {
  test.todo(description)
}

function runInMemory(rule: Rule.RuleModule, options: ScenarioOptions): void {
  const tester = makeTester(options)
  runTester(tester, rule, options, options.filename)
}

function runWithTempDir(rule: Rule.RuleModule, options: ScenarioOptions): void {
  const dir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), 'unslop-test-'))
  try {
    writeScenarioFiles(dir, options)
    const filename = getScenarioFilename(dir, options.filename)
    const hasTsconfig = hasTsconfigFile(options.files)
    const tester = hasTsconfig ? makeFsTester(options, dir) : makeTester(options)
    runTester(tester, rule, options, filename)
  } finally {
    node_fs.rmSync(dir, { recursive: true, force: true })
  }
}

function writeScenarioFiles(dir: string, options: ScenarioOptions): void {
  for (const file of options.files ?? []) {
    const full = node_path.join(dir, file.path)
    node_fs.mkdirSync(node_path.dirname(full), { recursive: true })
    node_fs.writeFileSync(full, getScenarioFileContent(file, options))
  }
}

function getScenarioFileContent(file: ScenarioFile, options: ScenarioOptions): string {
  if (file.content !== undefined) return file.content
  return options.filename === file.path ? options.code : ''
}

function getScenarioFilename(dir: string, filename: string | undefined): string | undefined {
  return filename !== undefined ? node_path.join(dir, filename) : undefined
}

function hasTsconfigFile(files: ScenarioFile[] | undefined): boolean {
  return (files ?? []).some((file) => file.path === 'tsconfig.json')
}

function makeTester(options: ScenarioOptions): RuleTester {
  const config: Record<string, unknown> = {
    languageOptions:
      options.typescript === true
        ? { parser, ecmaVersion: 'latest', sourceType: 'module' }
        : { ecmaVersion: 'latest', sourceType: 'module' },
  }
  if (options.settings !== undefined) {
    config['settings'] = options.settings
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
  }
  if (options.settings !== undefined) {
    config['settings'] = options.settings
  }
  return new RuleTester(config)
}

function runTester(
  tester: RuleTester,
  rule: Rule.RuleModule,
  options: ScenarioOptions,
  filename: string | undefined,
): void {
  const isInvalid = options.errors !== undefined && options.errors.length > 0

  const base = {
    code: options.code,
    ...(filename !== undefined && { filename }),
  }

  if (isInvalid) {
    const invalidCase = {
      ...base,
      errors: options.errors!,
      ...(options.output !== undefined && { output: options.output }),
    }
    tester.run('rule', rule, { valid: [], invalid: [invalidCase] })
  } else {
    tester.run('rule', rule, { valid: [base], invalid: [] })
  }
}

interface ScenarioOptions {
  files?: ScenarioFile[]
  typescript?: boolean
  settings?: unknown
  code: string
  filename?: string
  errors?: ScenarioError[]
  output?: string | null
}

interface ScenarioFile {
  path: string
  content?: string
}

interface ScenarioError {
  messageId?: string
  message?: string
  data?: Record<string, string>
}
