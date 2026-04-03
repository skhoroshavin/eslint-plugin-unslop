/* eslint-disable unslop/no-false-sharing, unslop/read-friendly-order */
import node_fs from 'node:fs'
import node_path from 'node:path'
import node_os from 'node:os'
import { RuleTester } from 'eslint'

export const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
})

export class ProjectFixture {
  private readonly prefix: string
  private readonly files: FixtureFile[]
  private dir = ''

  constructor(options: ProjectFixtureOptions) {
    this.prefix = options.prefix
    this.files = options.files
  }

  init(): void {
    this.dir = node_fs.mkdtempSync(node_path.join(node_os.tmpdir(), this.prefix))
    for (const file of this.files) {
      const full = node_path.join(this.dir, file.path)
      node_fs.mkdirSync(node_path.dirname(full), { recursive: true })
      node_fs.writeFileSync(full, file.content ?? '')
    }
  }

  cleanup(): void {
    if (this.dir) {
      node_fs.rmSync(this.dir, { recursive: true, force: true })
    }
  }

  filePath(relative: string): string {
    return node_path.join(this.dir, relative)
  }

  write(relative: string, content: string): void {
    const full = node_path.join(this.dir, relative)
    node_fs.mkdirSync(node_path.dirname(full), { recursive: true })
    node_fs.writeFileSync(full, content)
  }

  read(relative: string): string {
    return node_fs.readFileSync(node_path.join(this.dir, relative), 'utf-8')
  }
}

interface ProjectFixtureOptions {
  prefix: string
  files: FixtureFile[]
}

interface FixtureFile {
  path: string
  content?: string
}
