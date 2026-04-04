import type { ESLint, Linter } from 'eslint'
import packageJson from '../package.json'
import rules from './rules/index.js'

// configs.recommended.plugins.unslop must reference the plugin itself.
// Build plugin first with an empty configs object, then assign below.
const plugin: ESLint.Plugin = {
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules,
  configs: {},
}

const recommended: Linter.Config = {
  name: 'unslop/recommended',
  plugins: { unslop: plugin },
  rules: {
    'unslop/no-special-unicode': 'error',
    'unslop/no-unicode-escape': 'error',
  },
}

plugin.configs!['recommended'] = recommended

export default plugin
