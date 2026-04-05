import type { ESLint, Linter } from 'eslint'
import packageJson from '../package.json'
import rules from './rules/index.js'

// configs.minimal.plugins.unslop must reference the plugin itself.
// Build plugin first with an empty configs object, then assign below.
const plugin: ESLint.Plugin = {
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules,
  configs: {},
}

const minimal: Linter.Config = {
  name: 'unslop/minimal',
  plugins: { unslop: plugin },
  rules: {
    'unslop/no-special-unicode': 'error',
    'unslop/no-unicode-escape': 'error',
  },
}

const full: Linter.Config = {
  name: 'unslop/full',
  plugins: { unslop: plugin },
  rules: {
    'unslop/no-special-unicode': 'error',
    'unslop/no-unicode-escape': 'error',
    'unslop/import-control': 'error',
    'unslop/export-control': 'error',
    'unslop/no-false-sharing': 'error',
    'unslop/read-friendly-order': 'error',
  },
}

plugin.configs!['minimal'] = minimal
plugin.configs!['full'] = full

export default plugin
