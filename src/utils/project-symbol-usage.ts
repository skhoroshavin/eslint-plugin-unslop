import ts from 'typescript'

import { normalizeResolvedPath } from './tsconfig-resolution.js'

/**
 * Find the TypeScript source file for the given normalized filename.
 */
export function findTsSourceFile(program: ts.Program, filename: string): ts.SourceFile | undefined {
  const normalized = normalizeResolvedPath(filename)
  return program.getSourceFiles().find((sf) => normalizeResolvedPath(sf.fileName) === normalized)
}

/**
 * Count all project-wide uses of a symbol, excluding declarations, imports,
 * and export specifiers. Only .ts/.tsx source files are counted (.d.ts skipped).
 */
export function countProjectWideUses(
  targetSymbol: ts.Symbol,
  checker: ts.TypeChecker,
  program: ts.Program,
): number {
  let total = 0
  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile) continue
    total += countUsesInFile(sf, targetSymbol, checker)
  }
  return total
}

function countUsesInFile(
  sourceFile: ts.SourceFile,
  targetSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): number {
  let count = 0

  function walk(node: ts.Node): void {
    if (ts.isIdentifier(node) && isCountableUse(node, targetSymbol, checker)) {
      count++
    }
    ts.forEachChild(node, walk)
  }

  walk(sourceFile)
  return count
}

function isCountableUse(
  node: ts.Identifier,
  targetSymbol: ts.Symbol,
  checker: ts.TypeChecker,
): boolean {
  if (!isRealUsagePosition(node)) return false
  const sym = checker.getSymbolAtLocation(node)
  if (sym === undefined) return false
  return resolveCanonicalSymbol(sym, checker) === targetSymbol
}

/**
 * Returns true when the identifier is in a position that counts as a real use
 * (not a declaration, import, or re-export).
 */
function isRealUsagePosition(node: ts.Identifier): boolean {
  const parent = node.parent
  if (isDeclarationBinding(parent, node)) return false
  if (isImportPosition(parent, node)) return false
  if (ts.isExportSpecifier(parent)) return false
  if (ts.isExportAssignment(parent)) return false
  return true
}

function isDeclarationBinding(parent: ts.Node, node: ts.Identifier): boolean {
  return isNamedDeclParent(parent) && parent.name === node
}

function isNamedDeclParent(parent: ts.Node): parent is ts.NamedDeclaration {
  return (
    ts.isVariableDeclaration(parent) ||
    ts.isTypeAliasDeclaration(parent) ||
    ts.isInterfaceDeclaration(parent) ||
    ts.isFunctionDeclaration(parent) ||
    ts.isClassDeclaration(parent)
  )
}

function isImportPosition(parent: ts.Node, node: ts.Identifier): boolean {
  if (ts.isImportSpecifier(parent)) return true
  if (ts.isImportClause(parent) && parent.name === node) return true
  return ts.isNamespaceImport(parent) && parent.name === node
}

function resolveCanonicalSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if ((symbol.flags & ts.SymbolFlags.Alias) === 0) return symbol
  return checker.getAliasedSymbol(symbol)
}
