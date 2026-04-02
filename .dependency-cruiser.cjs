/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  allowedSeverity: 'error',
  allowed: [
    {
      comment: 'plugin-entry-local-imports',
      from: { path: '^src/index\\.ts$' },
      to: {
        dependencyTypes: ['local'],
        path: '^(src/rules/index\\.ts|package\\.json)$',
      },
    },
    {
      comment: 'plugin-entry-external-imports',
      from: { path: '^src/index\\.ts$' },
      to: {
        dependencyTypesNot: ['local'],
      },
    },
    {
      comment: 'rules-index-local-entrypoints',
      from: { path: '^src/rules/index\\.ts$' },
      to: {
        dependencyTypes: ['local'],
        path: '^src/rules/[^/]+/index\\.ts$',
      },
    },
    {
      comment: 'rules-index-external-imports',
      from: { path: '^src/rules/index\\.ts$' },
      to: {
        dependencyTypesNot: ['local'],
      },
    },
    {
      comment: 'rule-impl-local-same-module-or-utils',
      from: { path: '^src/rules/([^/]+)/(?!.*\\.test\\.ts$).*\\.ts$' },
      to: {
        dependencyTypes: ['local'],
        path: '^(src/rules/$1/|src/utils/)',
      },
    },
    {
      comment: 'rule-impl-external-imports',
      from: { path: '^src/rules/([^/]+)/(?!.*\\.test\\.ts$).*\\.ts$' },
      to: {
        dependencyTypesNot: ['local'],
      },
    },
    {
      comment: 'rule-tests-local-entrypoint-and-fixtures',
      from: { path: '^src/rules/([^/]+)/.*\\.test\\.ts$' },
      to: {
        dependencyTypes: ['local'],
        path: '^(src/rules/$1/index\\.ts|src/utils/test-fixtures\\.ts)$',
      },
    },
    {
      comment: 'rule-tests-external-imports',
      from: { path: '^src/rules/([^/]+)/.*\\.test\\.ts$' },
      to: {
        dependencyTypesNot: ['local'],
      },
    },
    {
      comment: 'utils-local-imports-stay-in-utils',
      from: { path: '^src/utils/.*\\.ts$' },
      to: {
        dependencyTypes: ['local'],
        path: '^src/utils/',
      },
    },
    {
      comment: 'utils-external-imports',
      from: { path: '^src/utils/.*\\.ts$' },
      to: {
        dependencyTypesNot: ['local'],
      },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: '^dist/' },
    exclude: '(^node_modules|^dist)',
  },
}
