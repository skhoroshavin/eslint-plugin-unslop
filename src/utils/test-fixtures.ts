/* eslint-disable unslop/no-false-sharing */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { RuleTester } from 'eslint'
import { clearCaches } from '@typescript-eslint/parser'

export const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

interface ProjectFile {
  path: string
  content?: string
}

export class ProjectFixture {
  constructor(spec: { prefix: string; files: ProjectFile[] }) {
    this.projectRoot = mkdtempSync(path.join(tmpdir(), spec.prefix))
    // Deduplicate by path, keeping the last entry when duplicates exist
    this.files = [...new Map(spec.files.map((f) => [f.path, f])).values()]
  }

  init(): void {
    this.cleanup()
    mkdirSync(this.projectRoot, { recursive: true })
    writeFileSync(path.join(this.projectRoot, 'package.json'), '{}')

    for (const file of this.files) {
      const filePath = path.join(this.projectRoot, file.path)
      mkdirSync(path.dirname(filePath), { recursive: true })
      writeFileSync(filePath, file.content ?? '')
    }
  }

  cleanup(): void {
    rmSync(this.projectRoot, { recursive: true, force: true })
    // Clear parser caches to prevent stale program state between tests
    clearCaches()
  }

  filePath(relativePath: string): string {
    return path.join(this.projectRoot, relativePath)
  }

  write(relativePath: string, content: string): void {
    const filePath = path.join(this.projectRoot, relativePath)
    mkdirSync(path.dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
  }

  read(relativePath: string): string {
    const filePath = path.join(this.projectRoot, relativePath)
    return readFileSync(filePath, 'utf-8')
  }

  private readonly projectRoot: string
  private readonly files: ProjectFile[]
}
