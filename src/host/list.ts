import { homedir } from 'node:os'
import { readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export interface FileEntry {
  name: string
  path: string
  size: number
  isDirectory: boolean
  hidden: boolean
}

export interface DirectoryListing {
  path: string
  parent: string | null
  home: string
  entries: FileEntry[]
}

/**
 * List one directory level with metadata. Omitted path resolves to the host
 * home directory. Files and directories are both returned (unlike the host
 * `host.listDirectory` RPC, which lists directories only).
 */
export async function listDirectory(path: string | undefined): Promise<DirectoryListing> {
  const home = homedir()
  const target = path === undefined || path === '' ? home : path
  const dirents = await readdir(target, { withFileTypes: true })
  const entries = await Promise.all(
    dirents.map(async (dirent) => {
      const full = join(target, dirent.name)
      let size = 0
      if (dirent.isFile()) {
        try {
          size = (await stat(full)).size
        } catch {
          // Unreadable file: report size 0 rather than failing the whole listing.
        }
      }
      return {
        name: dirent.name,
        path: full,
        size,
        isDirectory: dirent.isDirectory(),
        hidden: dirent.name.startsWith('.'),
      }
    }),
  )
  return {
    path: target,
    parent: target === home ? null : dirname(target),
    home,
    entries,
  }
}
