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
