import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
// import the built plugin entry so ESLint can load the compiled ESM output
import unslop from './dist/index.js'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'reports/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: globals.node,
    },
    plugins: { unslop },
    rules: {
      complexity: ['error', { max: 8 }],
      'max-params': ['error', { max: 4 }],
      'max-lines-per-function': ['error', { max: 50 }],
      'max-lines': ['error', { max: 600 }],
      'unslop/no-deep-imports': ['error', { sourceRoot: 'src' }],
      'unslop/read-friendly-order': ['error'],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression',
          message: "Type assertions with 'as' are forbidden.",
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      complexity: ['error', { max: 1 }],
    },
  },
  {
    files: ['src/rules/index.ts'],
    settings: {
      unslop: {
        sourceRoot: 'src',
        architecture: {
          'rules/index.ts': {
            imports: ['rules/*'],
          },
          'rules/*': {
            imports: ['utils'],
            exports: ['^default$'],
          },
          utils: {
            imports: [],
          },
        },
      },
    },
    rules: {
      'unslop/import-control': 'error',
      'unslop/export-control': 'error',
    },
  },
]
