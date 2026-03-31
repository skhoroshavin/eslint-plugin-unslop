import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
// import the built plugin entry so ESLint can load the compiled ESM output
import unslop from './dist/index.js'

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
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
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'unslop/no-false-sharing': ['error', { dirs: [{ path: 'src/utils' }] }],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      complexity: ['error', { max: 1 }],
    },
  },
]
