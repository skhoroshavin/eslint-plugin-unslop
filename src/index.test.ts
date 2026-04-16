import node_fs from 'node:fs'
import node_os from 'node:os'
import node_path from 'node:path'

import { ESLint } from 'eslint'

import type { Linter } from 'eslint'

import { expect, test } from 'vitest'
import unslop from './index.js'

const FULL_CONFIG = unslop.configs?.full
const FULL_RULES: Linter.Config['rules'] = Array.isArray(FULL_CONFIG)
  ? undefined
  : FULL_CONFIG?.rules

test('exports minimal and full configs and no recommended alias', () => {
  expect(unslop.configs).toHaveProperty('minimal')
  expect(unslop.configs).toHaveProperty('full')
  expect(unslop.configs).not.toHaveProperty('recommended')
  expect(Reflect.get(unslop.configs!, 'recommended')).toBeUndefined()
})

test('minimal config enables only symbol fixer rules', () => {
  expect(unslop.configs).toHaveProperty('minimal.rules.unslop/no-special-unicode', 'error')
  expect(unslop.configs).toHaveProperty('minimal.rules.unslop/no-unicode-escape', 'error')
})

test('full config enables all documented rules', () => {
  expect(FULL_RULES).toMatchObject({
    'unslop/no-special-unicode': 'error',
    'unslop/no-unicode-escape': 'error',
    'unslop/import-control': 'error',
    'unslop/no-whitebox-testing': 'error',
    'unslop/export-control': 'error',
    'unslop/no-false-sharing': 'error',
    'unslop/no-single-use-constants': 'error',
    'unslop/read-friendly-order': 'error',
  })
})

test('full config surfaces tsconfig configuration failures for required-context rules', async () => {
  const dir = createTempConfigFailureProject()
  try {
    const eslint = createFullConfigLinter(dir, DEFAULT_ARCHITECTURE)
    const [entrypointResult] = await lintProjectFiles(eslint, dir)
    expect(getRuleIds(entrypointResult)).toEqual([
      'unslop/import-control',
      'unslop/export-control',
      'unslop/no-false-sharing',
      'unslop/no-single-use-constants',
    ])
    expectFirstMessageToContain(entrypointResult, node_path.join(dir, 'src/module/index.ts'))
    expectFirstMessageToContain(entrypointResult, node_path.join(dir, 'tsconfig.json'))

    const [, testFileResult] = await lintProjectFiles(eslint, dir)
    expect(getRuleIds(testFileResult)).toEqual([
      'unslop/import-control',
      'unslop/no-whitebox-testing',
      'unslop/export-control',
      'unslop/no-false-sharing',
    ])
    expectFirstMessageToContain(testFileResult, node_path.join(dir, 'src/module/some.test.ts'))
    expectFirstMessageToContain(testFileResult, node_path.join(dir, 'tsconfig.json'))
  } finally {
    node_fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('full config surfaces invalid architecture selectors for impacted architecture rules', async () => {
  const dir = createTempValidProject()
  try {
    const eslint = createFullConfigLinter(dir, {
      'module/+': { imports: [], shared: true },
    })

    const [entrypointResult, testFileResult] = await lintProjectFiles(eslint, dir)
    expect(getRuleIds(entrypointResult)).toEqual([
      'unslop/import-control',
      'unslop/export-control',
      'unslop/no-false-sharing',
      'unslop/no-single-use-constants',
    ])
    expectFirstMessageToContain(
      entrypointResult,
      'unsupported architecture key selector "module/+"',
    )

    expect(getRuleIds(testFileResult)).toEqual([
      'unslop/import-control',
      'unslop/no-whitebox-testing',
      'unslop/export-control',
      'unslop/no-false-sharing',
    ])
    expectFirstMessageToContain(testFileResult, 'unsupported architecture key selector "module/+"')
  } finally {
    node_fs.rmSync(dir, { recursive: true, force: true })
  }
})

function createTempConfigFailureProject(): string {
  const dir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), 'unslop-full-config-'))
  node_fs.mkdirSync(node_path.join(dir, 'src/module'), { recursive: true })
  node_fs.writeFileSync(node_path.join(dir, 'tsconfig.json'), '{')
  return dir
}

function createTempValidProject(): string {
  const dir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), 'unslop-full-config-'))
  node_fs.mkdirSync(node_path.join(dir, 'src/module'), { recursive: true })
  node_fs.writeFileSync(
    node_path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { rootDir: './src' }, include: ['src/**/*.ts'] }),
  )
  return dir
}

const DEFAULT_ARCHITECTURE: Record<string, unknown> = { module: { imports: [], shared: true } }

function createFullConfigLinter(dir: string, architecture: Record<string, unknown>): ESLint {
  return new ESLint(makeFullConfigLinterOptions(dir, FULL_RULES, architecture))
}

function makeFullConfigLinterOptions(
  dir: string,
  rules: Linter.Config['rules'],
  architecture: Record<string, unknown>,
): ESLint.Options {
  return {
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        plugins: { unslop },
        rules,
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        settings: { unslop: { architecture } },
      },
    ],
  }
}

async function lintProjectFiles(
  eslint: ESLint,
  dir: string,
): Promise<[ESLint.LintResult, ESLint.LintResult]> {
  const [entrypointResult] = await eslint.lintText('export const VALUE = 1', {
    filePath: node_path.join(dir, 'src/module/index.ts'),
  })
  const [testFileResult] = await eslint.lintText("import { model } from './model.ts'", {
    filePath: node_path.join(dir, 'src/module/some.test.ts'),
  })
  return [entrypointResult, testFileResult]
}

function getRuleIds(result: ESLint.LintResult): Array<string | null> {
  return result.messages.map((message) => message.ruleId)
}

function expectFirstMessageToContain(result: ESLint.LintResult, text: string): void {
  const firstMessage = result.messages[0]!.message
  expect(firstMessage).toContain(text)
}
