import type { Node } from 'estree'

export function getDeclName(node: Node): string | null {
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return idName(node) ?? null
    case 'VariableDeclaration':
      return varDeclName(node)
    case 'ExportNamedDeclaration':
      return exportDeclName(node)
    case 'ExportDefaultDeclaration':
      return null
    default:
      return idName(node) ?? null
  }
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
    walkThisMember(node, deps)
    return
  }
  walkThisChildren(node, deps)
}

function walkThisMember(node: unknown, deps: Set<string>): void {
  if (strProp(prop(node, 'object'), 'type') === 'ThisExpression') {
    const name = strProp(prop(node, 'property'), 'name')
    if (name) deps.add(name)
  }
  walkThisDeps(prop(node, 'object'), deps)
}

export function getDeclKind(node: unknown): 'constant' | 'type' | 'function' | 'other' {
  const t = strProp(node, 'type') ?? ''
  if (isTypeDecl(t)) return 'type'
  if (t === 'ExportNamedDeclaration') return getExportedDeclKind(node)
  if (t === 'FunctionDeclaration') return 'function'
  if (t === 'VariableDeclaration') return getVarDeclKind(node)
  return 'other'
}

function isTypeDecl(t: string): boolean {
  return t === 'TSInterfaceDeclaration' || t === 'TSTypeAliasDeclaration'
}

function getExportedDeclKind(node: unknown): 'constant' | 'type' | 'function' | 'other' {
  const decl = prop(node, 'declaration')
  if (!decl || typeof decl !== 'object') return 'other'
  const declType = strProp(decl, 'type')
  if (!declType) return 'other'
  if (isTypeDecl(declType)) return 'type'
  if (declType === 'VariableDeclaration' || declType === 'FunctionDeclaration') {
    return getDeclKind(decl)
  }
  return 'other'
}

function getVarDeclKind(node: unknown): 'constant' | 'type' | 'function' | 'other' {
  const decls = prop(node, 'declarations')
  if (!Array.isArray(decls) || decls.length === 0) return 'other'
  const name = idName(decls[0])
  if (name && /^[A-Z][A-Z_0-9]*$/.test(name)) return 'constant'
  const initType = strProp(prop(decls[0], 'init'), 'type')
  if (initType === 'FunctionExpression' || initType === 'ArrowFunctionExpression') {
    return 'function'
  }
  return 'other'
}

export function isLocalPublicExport(node: Node): boolean {
  if (node.type === 'ExportNamedDeclaration') {
    return !!prop(node, 'declaration')
  }
  return false
}

export function isEagerInit(node: Node): boolean {
  const t = node.type
  if (t === 'ExpressionStatement' || t === 'IfStatement') return true
  if (t === 'ExportDefaultDeclaration') return isEagerDefaultExport(node)
  return isEagerVarDecl(t === 'ExportNamedDeclaration' ? prop(node, 'declaration') : node)
}

function isEagerDefaultExport(node: Node): boolean {
  const declType = strProp(prop(node, 'declaration'), 'type')
  return declType === 'CallExpression' || declType === 'NewExpression'
}

function isEagerVarDecl(inner: unknown): boolean {
  if (strProp(inner, 'type') !== 'VariableDeclaration') return false
  const decls = prop(inner, 'declarations')
  if (!Array.isArray(decls) || decls.length === 0) return false
  const initType = strProp(prop(decls[0], 'init'), 'type')
  if (!initType) return false
  return initType !== 'FunctionExpression' && initType !== 'ArrowFunctionExpression'
}

export function isReexportNode(node: Node): boolean {
  if (node.type === 'ExportNamedDeclaration') {
    return !!prop(node, 'source')
  }
  return node.type === 'ExportAllDeclaration'
}

export function isLocalExportList(node: Node): boolean {
  if (node.type !== 'ExportNamedDeclaration') return false
  if (prop(node, 'source')) return false
  if (prop(node, 'declaration')) return false
  const specs = prop(node, 'specifiers')
  return Array.isArray(specs) && specs.length > 0
}

export function isLocalExportDefault(node: Node): boolean {
  if (node.type !== 'ExportDefaultDeclaration') return false
  return strProp(prop(node, 'declaration'), 'type') !== 'Identifier'
}

function getDeclNameFromUnknown(obj: unknown): string | null {
  const t = strProp(obj, 'type')
  if (!t) return null
  if (t === 'FunctionDeclaration' || t === 'ClassDeclaration') return idName(obj) ?? null
  if (t === 'VariableDeclaration') return varDeclNameFromUnknown(obj)
  if (t === 'ExportNamedDeclaration') return exportDeclNameFromUnknown(obj)
  return idName(obj) ?? null
}

function varDeclName(node: Node): string | null {
  return varDeclNameFromUnknown(node)
}

function varDeclNameFromUnknown(obj: unknown): string | null {
  const decls = prop(obj, 'declarations')
  if (!Array.isArray(decls) || decls.length === 0) return null
  return idName(decls[0]) ?? null
}

function exportDeclName(node: Node): string | null {
  return exportDeclNameFromUnknown(node)
}

function exportDeclNameFromUnknown(obj: unknown): string | null {
  const decl = prop(obj, 'declaration')
  if (!decl || typeof decl !== 'object') return null
  if (!strProp(decl, 'type')) return null
  return getDeclNameFromUnknown(decl)
}

function idName(obj: unknown): string | undefined {
  const id = prop(obj, 'id')
  if (strProp(id, 'type') !== 'Identifier') return undefined
  return strProp(id, 'name')
}

function walkThisChildren(node: unknown, deps: Set<string>): void {
  walkNodeChildren(node, (child) => {
    walkThisDeps(child, deps)
  })
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
  if (!node || typeof node !== 'object') return
  const t = strProp(node, 'type')
  if (!t) return
  if (t === 'Identifier') {
    addIdentifier(node, ids, skip)
    return
  }
  if (t === 'Literal' || t === 'TemplateLiteral') return
  if (t === 'MemberExpression') {
    walkMemberIds(node, ids, skip)
    return
  }
  walkIdsBody(node, t, ids, skip)
}

function walkIdsBody(node: unknown, t: string, ids: Set<string>, skip: string | null): void {
  if (isPropertyLike(t)) {
    walkPropertyIds(node, ids, skip)
    return
  }
  if (isFunctionLike(t)) {
    walkFunctionLike(node, ids, skip)
    return
  }
  walkChildren(node, ids, skip)
}

function addIdentifier(node: unknown, ids: Set<string>, skip: string | null): void {
  const name = strProp(node, 'name')
  if (name && name !== skip) ids.add(name)
}

function walkMemberIds(node: unknown, ids: Set<string>, skip: string | null): void {
  walkIds(prop(node, 'object'), ids, skip)
  if (prop(node, 'computed')) walkIds(prop(node, 'property'), ids, skip)
}

function walkPropertyIds(node: unknown, ids: Set<string>, skip: string | null): void {
  if (prop(node, 'computed')) walkIds(prop(node, 'key'), ids, skip)
  walkIds(prop(node, 'value'), ids, skip)
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
    if (isMetaKey(key)) continue
    visitValue(Reflect.get(node, key), visit)
  }
}

function isMetaKey(key: string): boolean {
  return key === 'parent' || key === 'type' || key === 'range' || key === 'loc'
}

function visitValue(val: unknown, visit: (child: unknown) => void): void {
  if (Array.isArray(val)) {
    for (const child of val) visit(child)
  } else {
    visit(val)
  }
}
