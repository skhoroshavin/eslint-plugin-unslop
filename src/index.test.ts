import node_fs from 'node:fs'
import node_os from 'node:os'
import node_path from 'node:path'

import { ESLint } from 'eslint'
import { expect, test } from 'vitest'
import unslop from './index.js'

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
  expect(unslop.configs).toHaveProperty('full.rules.unslop/no-special-unicode', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/no-unicode-escape', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/import-control', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/no-whitebox-testing', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/export-control', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/no-false-sharing', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/no-single-use-constants', 'error')
  expect(unslop.configs).toHaveProperty('full.rules.unslop/read-friendly-order', 'error')
})

test('full config surfaces tsconfig configuration failures for required-context rules', async () => {
  const dir = createTempConfigFailureProject()
  try {
    const eslint = createFullConfigLinter(dir)
    const [entrypointResult] = await lintProjectFiles(eslint, dir)
    expect(getRuleIds(entrypointResult)).toEqual([
      'unslop/import-control',
      'unslop/no-false-sharing',
      'unslop/no-single-use-constants',
    ])
    expectFirstMessageToContain(entrypointResult, node_path.join(dir, 'src/module/index.ts'))
    expectFirstMessageToContain(entrypointResult, node_path.join(dir, 'tsconfig.json'))

    const [, testFileResult] = await lintProjectFiles(eslint, dir)
    expect(getRuleIds(testFileResult)).toEqual([
      'unslop/import-control',
      'unslop/no-whitebox-testing',
    ])
    expectFirstMessageToContain(testFileResult, node_path.join(dir, 'src/module/some.test.ts'))
    expectFirstMessageToContain(testFileResult, node_path.join(dir, 'tsconfig.json'))
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

function createFullConfigLinter(dir: string): ESLint {
  const rules = Reflect.get(unslop.configs!.full, 'rules')
  return new ESLint({
    cwd: dir,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        plugins: { unslop },
        rules,
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        settings: {
          unslop: {
            architecture: {
              module: { imports: [], shared: true },
            },
          },
        },
      },
    ],
  })
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
