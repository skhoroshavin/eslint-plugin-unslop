import type {
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Node,
  VariableDeclaration,
} from 'estree'

export function getDeclName(node: Node): string | null {
  if (isNamedFunctionOrClass(node.type)) return idName(node) ?? null
  if (node.type === 'VariableDeclaration') return varDeclName(node)
  if (node.type === 'ExportNamedDeclaration') return exportDeclName(node)
  if (node.type === 'ExportDefaultDeclaration') return null
  return idName(node) ?? null
}

export function collectDeps(node: Node, skip: string | null): Set<string> {
  const ids = new Set<string>()
  walkIds(node, ids, skip)
  return ids
}

export function walkThisDeps(node: unknown, deps: Set<string>): void {
  if (!node || typeof node !== 'object') return
  const t = strProp(node, 'type')
  if (!t) return
  if (t === 'MemberExpression' && !prop(node, 'computed')) {
    if (strProp(prop(node, 'object'), 'type') === 'ThisExpression') {
      const name = strProp(prop(node, 'property'), 'name')
      if (name) deps.add(name)
    }
    walkThisDeps(prop(node, 'object'), deps)
    return
  }
  walkThisChildren(node, deps)
}

export function getDeclKind(node: Node): 'constant' | 'type' | 'function' | 'other' {
  if (isTsTypeDeclaration(node)) return 'type'
  if (node.type === 'ExportNamedDeclaration') {
    return getExportedDeclKind(node)
  }
  if (node.type === 'FunctionDeclaration') return 'function'
  if (node.type === 'VariableDeclaration') return getVarDeclKind(node)
  return 'other'
}

export function isReexportNode(node: Node): boolean {
  if (node.type === 'ExportNamedDeclaration') return node.source != null
  return node.type === 'ExportAllDeclaration'
}

export function isLocalExportList(node: Node): boolean {
  if (node.type !== 'ExportNamedDeclaration') return false
  return node.source == null && node.declaration == null && node.specifiers.length > 0
}

export function isLocalExportDefault(node: Node): boolean {
  if (node.type !== 'ExportDefaultDeclaration') return false
  return node.declaration.type !== 'Identifier'
}

export function isLocalPublicExport(node: Node): boolean {
  if (node.type !== 'ExportNamedDeclaration') return false
  return node.declaration != null
}

export function isEagerInit(node: Node): boolean {
  if (node.type === 'ExpressionStatement' || node.type === 'IfStatement') return true
  if (node.type === 'ExportDefaultDeclaration') {
    return isEagerDefaultExport(node)
  }
  if (node.type === 'ExportNamedDeclaration') {
    return node.declaration != null ? isEagerVarDecl(node.declaration) : false
  }
  return isEagerVarDecl(node)
}

function varDeclName(node: VariableDeclaration): string | null {
  if (node.declarations.length === 0) return null
  const { id } = node.declarations[0]
  return id.type === 'Identifier' ? id.name : null
}

function exportDeclName(node: ExportNamedDeclaration): string | null {
  if (node.declaration == null) return null
  return getDeclName(node.declaration)
}

function idName(obj: unknown): string | undefined {
  const id = prop(obj, 'id')
  if (strProp(id, 'type') !== 'Identifier') return undefined
  return strProp(id, 'name')
}

function isNamedFunctionOrClass(type: string): boolean {
  return type === 'FunctionDeclaration' || type === 'ClassDeclaration'
}

function walkThisChildren(node: unknown, deps: Set<string>): void {
  walkNodeChildren(node, (child) => {
    walkThisDeps(child, deps)
  })
}

function getExportedDeclKind(
  node: ExportNamedDeclaration,
): 'constant' | 'type' | 'function' | 'other' {
  if (node.declaration == null) return 'other'
  if (isTsTypeDeclaration(node.declaration)) return 'type'
  if (
    node.declaration.type === 'VariableDeclaration' ||
    node.declaration.type === 'FunctionDeclaration'
  ) {
    return getDeclKind(node.declaration)
  }
  return 'other'
}

function getVarDeclKind(node: VariableDeclaration): 'constant' | 'function' | 'other' {
  if (node.declarations.length === 0) return 'other'
  const first = node.declarations[0]
  if (first.id.type === 'Identifier' && /^[A-Z][A-Z_0-9]*$/.test(first.id.name)) {
    return 'constant'
  }
  const initType = first.init?.type
  if (initType === 'FunctionExpression' || initType === 'ArrowFunctionExpression') {
    return 'function'
  }
  return 'other'
}

function isTsTypeDeclaration(node: Node): boolean {
  const type = strProp(node, 'type')
  return type === 'TSInterfaceDeclaration' || type === 'TSTypeAliasDeclaration'
}

function isEagerDefaultExport(node: ExportDefaultDeclaration): boolean {
  const { type } = node.declaration
  return type === 'CallExpression' || type === 'NewExpression'
}

function isEagerVarDecl(node: Node): boolean {
  if (node.type !== 'VariableDeclaration') return false
  if (node.declarations.length === 0) return false
  const initType = node.declarations[0].init?.type
  if (!initType) return false
  return initType !== 'FunctionExpression' && initType !== 'ArrowFunctionExpression'
}

function prop(obj: unknown, key: string): unknown {
  if (typeof obj !== 'object' || obj === null) return undefined
  return Reflect.get(obj, key)
}

function strProp(obj: unknown, key: string): string | undefined {
  const v = prop(obj, key)
  return typeof v === 'string' ? v : undefined
}

function walkIds(node: unknown, ids: Set<string>, skip: string | null): void {
  const t = nodeType(node)
  if (!t) return
  if (walkIdentifier(node, t, ids, skip)) return
  if (isLiteralLike(t)) return
  if (walkMemberExpression(node, t, ids, skip)) return
  if (walkPropertyNode(node, t, ids, skip)) return
  if (walkFunctionNode(node, t, ids, skip)) return
  walkChildren(node, ids, skip)
}

function nodeType(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined
  return strProp(node, 'type')
}

function walkIdentifier(
  node: unknown,
  type: string,
  ids: Set<string>,
  skip: string | null,
): boolean {
  if (type !== 'Identifier') return false
  const name = strProp(node, 'name')
  if (name && name !== skip) ids.add(name)
  return true
}

function isLiteralLike(type: string): boolean {
  return type === 'Literal' || type === 'TemplateLiteral'
}

function walkMemberExpression(
  node: unknown,
  type: string,
  ids: Set<string>,
  skip: string | null,
): boolean {
  if (type !== 'MemberExpression') return false
  walkIds(prop(node, 'object'), ids, skip)
  if (prop(node, 'computed')) walkIds(prop(node, 'property'), ids, skip)
  return true
}

function walkPropertyNode(
  node: unknown,
  type: string,
  ids: Set<string>,
  skip: string | null,
): boolean {
  if (!isPropertyLike(type)) return false
  if (prop(node, 'computed')) walkIds(prop(node, 'key'), ids, skip)
  walkIds(prop(node, 'value'), ids, skip)
  return true
}

function walkFunctionNode(
  node: unknown,
  type: string,
  ids: Set<string>,
  skip: string | null,
): boolean {
  if (!isFunctionLike(type)) return false
  walkFunctionLike(node, ids, skip)
  return true
}

function isPropertyLike(t: string): boolean {
  return t === 'Property' || t === 'MethodDefinition' || t === 'PropertyDefinition'
}

function isFunctionLike(t: string): boolean {
  return (
    t === 'FunctionDeclaration' || t === 'FunctionExpression' || t === 'ArrowFunctionExpression'
  )
}

function walkFunctionLike(node: unknown, ids: Set<string>, skip: string | null): void {
  walkIds(prop(node, 'body'), ids, skip)
  walkIds(prop(node, 'returnType'), ids, skip)
  const params = prop(node, 'params')
  if (!Array.isArray(params)) return
  for (const p of params) {
    walkIds(prop(p, 'typeAnnotation'), ids, skip)
  }
}

function walkChildren(node: unknown, ids: Set<string>, skip: string | null): void {
  walkNodeChildren(node, (child) => {
    walkIds(child, ids, skip)
  })
}

function walkNodeChildren(node: unknown, visit: (child: unknown) => void): void {
  if (typeof node !== 'object' || node === null) return
  for (const key of Object.keys(node)) {
    if (isSkippedChildKey(key)) continue
    visitChildValue(Reflect.get(node, key), visit)
  }
}

function isSkippedChildKey(key: string): boolean {
  return key === 'parent' || key === 'type' || key === 'range' || key === 'loc'
}

function visitChildValue(value: unknown, visit: (child: unknown) => void): void {
  if (!Array.isArray(value)) {
    visit(value)
    return
  }
  for (const child of value) visit(child)
}
