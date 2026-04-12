export {
  getArchitectureRuleState,
  isPublicEntrypoint,
  matchFileToArchitectureModule,
} from './architecture-policy.js'

export {
  getRelativePath,
  isInsidePath,
  isSamePath,
  normalizeResolvedPath,
  resolveImportTarget,
} from './tsconfig-resolution.js'

export { getTypeScriptProjectContext, isFileInProject } from './ts-program.js'
export type { ProjectContext } from './ts-program.js'

export { getDeclarationNamesFromExport } from './export-symbols.js'
