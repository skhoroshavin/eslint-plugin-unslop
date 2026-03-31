import path from 'node:path'

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

export function isInsidePath(filePath: string, parentPath: string): boolean {
  const relativePath = path.relative(parentPath, filePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}
