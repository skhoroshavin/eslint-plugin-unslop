import type { Pattern, VariableDeclaration } from 'estree'

export function getDeclarationNamesFromExport(declaration: unknown): string[] {
  if (isVariableDeclaration(declaration)) {
    return declaration.declarations.flatMap((entry) => getPatternNames(entry.id))
  }
  if (hasStringName(declaration)) {
    return [declaration.id.name]
  }
  return []
}

function isVariableDeclaration(value: unknown): value is VariableDeclaration {
  if (typeof value !== 'object' || value === null) return false
  return 'type' in value && value.type === 'VariableDeclaration'
}

function getPatternNames(pattern: Pattern): string[] {
  if (pattern.type === 'Identifier') return [pattern.name]
  return []
}

function hasStringName(value: unknown): value is { id: { name: string } } {
  if (typeof value !== 'object' || value === null) return false
  if (!('id' in value)) return false
  const id = value.id
  if (typeof id !== 'object' || id === null) return false
  if (!('name' in id)) return false
  return typeof id.name === 'string'
}
