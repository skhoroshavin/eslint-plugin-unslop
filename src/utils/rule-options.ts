export function readSourceRootOption(options: unknown[]): string | undefined {
  const option = options[0]
  if (!isRecord(option) || !('sourceRoot' in option)) {
    return undefined
  }

  return typeof option.sourceRoot === 'string' ? option.sourceRoot : undefined
}

export type SharingMode = 'file' | 'dir'

export interface DirEntry {
  path: string
  mode: SharingMode
}

export function readDirsOption(options: unknown[], rootMode: SharingMode = 'file'): DirEntry[] {
  const option = options[0]
  if (!isRecord(option) || !('dirs' in option)) {
    return []
  }

  const rootModeResolved = readRootMode(option, rootMode)

  const { dirs } = option
  if (!Array.isArray(dirs)) {
    return []
  }

  return dirs.flatMap((entry) => {
    const parsed = parseDirEntry(entry, rootModeResolved)
    return parsed ? [parsed] : []
  })
}

function readRootMode(option: object, fallback: SharingMode): SharingMode {
  if (!('mode' in option)) {
    return fallback
  }

  return option.mode === 'dir' ? 'dir' : 'file'
}

function parseDirEntry(entry: unknown, defaultMode: SharingMode): DirEntry | undefined {
  if (!isRecord(entry) || !('path' in entry)) {
    return undefined
  }

  if (typeof entry.path !== 'string') {
    return undefined
  }

  const modeValue = 'mode' in entry ? entry.mode : undefined
  const mode: SharingMode = modeValue === 'dir' ? 'dir' : defaultMode

  return { path: entry.path, mode }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value != undefined && typeof value === 'object'
}
