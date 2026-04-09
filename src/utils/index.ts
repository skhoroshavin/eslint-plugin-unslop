export {
  isPublicEntrypoint,
  matchFileToArchitectureModule,
  normalizePath,
  readArchitecturePolicy,
  resolveImportTarget,
} from './architecture-policy.js'
export type { TsconfigInfo } from './tsconfig-resolution.js'
export { getTsconfigInfo, resolvePathAlias } from './tsconfig-resolution.js'

export { getDeclarationNamesFromExport } from './export-symbols.js'
