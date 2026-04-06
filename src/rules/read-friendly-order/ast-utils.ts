/* eslint-disable no-restricted-syntax, complexity, unslop/read-friendly-order */
import type { Node } from 'estree'

function prop(obj: unknown, key: string): unknown {
  if (typeof obj !== 'object' || obj === null) return undefined
  return Reflect.get(obj, key)
}

function strProp(obj: unknown, key: string): string | undefined {
  const v = prop(obj, key)
  return typeof v === 'string' ? v : undefined
}

export function getDeclName(node: Node): string | null {
  switch (node.type) {
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return idName(node) ?? null
    case 'VariableDeclaration':
      return varDeclName(node) ?? null
    case 'ExportNamedDeclaration':
      return exportDeclName(node)
    case 'ExportDefaultDeclaration':
      return null
    default:
      return idName(node) ?? null
  }
}

function varDeclName(node: Node): string | null {
  const decls = prop(node, 'declarations')
  if (!Array.isArray(decls) || decls.length === 0) return null
  return idName(decls[0]) ?? null
}

function exportDeclName(node: Node): string | null {
  const decl = prop(node, 'declaration')
  if (!decl || typeof decl !== 'object') return null
  if (!strProp(decl, 'type')) return null
  return getDeclName(decl as Node)
}

function idName(obj: unknown): string | undefined {
  const id = prop(obj, 'id')
  if (strProp(id, 'type') !== 'Identifier') return undefined
  return strProp(id, 'name')
}

export function collectDeps(node: Node, skip: string | null): Set<string> {
  const ids = new Set<string>()
  walkIds(node, ids, skip)
  return ids
}

function walkIds(node: unknown, ids: Set<string>, skip: string | null): void {
  if (!node || typeof node !== 'object') return
  const t = strProp(node, 'type')
  if (!t) return
  if (t === 'Identifier') {
    const name = strProp(node, 'name')
    if (name && name !== skip) ids.add(name)
    return
  }
  if (t === 'Literal' || t === 'TemplateLiteral') return
  if (t === 'MemberExpression') {
    walkIds(prop(node, 'object'), ids, skip)
    if (prop(node, 'computed')) walkIds(prop(node, 'property'), ids, skip)
    return
  }
  if (isPropertyLike(t)) {
    if (prop(node, 'computed')) walkIds(prop(node, 'key'), ids, skip)
    walkIds(prop(node, 'value'), ids, skip)
    return
  }
  if (isFunctionLike(t)) {
    walkFunctionLike(node, ids, skip)
    return
  }
  walkChildren(node, ids, skip)
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

function walkThisChildren(node: unknown, deps: Set<string>): void {
  walkNodeChildren(node, (child) => {
    walkThisDeps(child, deps)
  })
}

function walkNodeChildren(node: unknown, visit: (child: unknown) => void): void {
  if (typeof node !== 'object' || node === null) return
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'type' || key === 'range' || key === 'loc') continue
    const val = Reflect.get(node, key)
    if (Array.isArray(val)) {
      for (const child of val) visit(child)
    } else {
      visit(val)
    }
  }
}

export function getDeclKind(node: Node): 'constant' | 'type' | 'function' | 'other' {
  const t = node.type
  // Type declarations (using type assertions for TS-specific nodes)
  if ((t as string) === 'TSInterfaceDeclaration' || (t as string) === 'TSTypeAliasDeclaration') {
    return 'type'
  }
  // Check for exported types
  if (t === 'ExportNamedDeclaration') {
    const decl = prop(node, 'declaration')
    if (decl && typeof decl === 'object') {
      const declType = strProp(decl, 'type')
      if (declType === 'TSInterfaceDeclaration' || declType === 'TSTypeAliasDeclaration') {
        return 'type'
      }
      if (declType === 'VariableDeclaration' || declType === 'FunctionDeclaration') {
        return getDeclKind(decl as Node)
      }
    }
    return 'other'
  }
  // Function declarations
  if (t === 'FunctionDeclaration') {
    return 'function'
  }
  // Variable declarations - check if it's a constant
  if (t === 'VariableDeclaration') {
    const decls = prop(node, 'declarations')
    if (!Array.isArray(decls) || decls.length === 0) return 'other'
    const name = idName(decls[0])
    if (name && /^[A-Z][A-Z_0-9]*$/.test(name)) {
      return 'constant'
    }
    const initType = strProp(prop(decls[0], 'init'), 'type')
    if (initType === 'FunctionExpression' || initType === 'ArrowFunctionExpression') {
      return 'function'
    }
    return 'other'
  }
  return 'other'
}

export function isLocalPublicExport(node: Node): boolean {
  // Local export declarations: export function/class/const/type/interface ...
  if (node.type === 'ExportNamedDeclaration') {
    // Has a declaration (not just specifiers/re-export)
    return !!prop(node, 'declaration')
  }
  return false
}

export function isEagerInit(node: Node): boolean {
  const t = node.type
  if (t === 'ExpressionStatement' || t === 'IfStatement') return true
  if (t === 'ExportDefaultDeclaration') {
    const declType = strProp(prop(node, 'declaration'), 'type')
    return declType === 'CallExpression' || declType === 'NewExpression'
  }
  const inner = t === 'ExportNamedDeclaration' ? prop(node, 'declaration') : node
  if (strProp(inner, 'type') !== 'VariableDeclaration') return false
  const decls = prop(inner, 'declarations')
  if (!Array.isArray(decls) || decls.length === 0) return false
  const initType = strProp(prop(decls[0], 'init'), 'type')
  if (!initType) return false
  return initType !== 'FunctionExpression' && initType !== 'ArrowFunctionExpression'
}

export function isReexportNode(node: Node): boolean {
  // External re-exports: export { ... } from '...' or export * from '...'
  if (node.type === 'ExportNamedDeclaration') {
    if (prop(node, 'source')) return true
    return false
  }
  if (node.type === 'ExportAllDeclaration') {
    return true
  }
  return false
}

export function isLocalExportList(node: Node): boolean {
  // Local export lists: export { ... } without a source (not a re-export)
  if (node.type === 'ExportNamedDeclaration') {
    if (prop(node, 'source')) return false
    if (prop(node, 'declaration')) return false
    const specs = prop(node, 'specifiers')
    return Array.isArray(specs) && specs.length > 0
  }
  return false
}

export function isLocalExportDefault(node: Node): boolean {
  // Local export default: export default <declaration>
  if (node.type === 'ExportDefaultDeclaration') {
    return strProp(prop(node, 'declaration'), 'type') !== 'Identifier'
  }
  return false
}
