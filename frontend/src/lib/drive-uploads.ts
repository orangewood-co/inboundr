import * as React from "react"
import { toast } from "sonner"

import { createDriveFolder, listDriveNodes, uploadDriveFile } from "@/lib/drive"

export type UploadStatus = "pending" | "uploading" | "done" | "error"

export interface UploadTask {
  id: string
  name: string
  parentId: string | null
  file: File
  status: UploadStatus
  progress: number
  error?: string
}

export interface FileDescriptor {
  file: File
  name: string
  parentId: string | null
}

type FolderCache = Map<string, string>
type ListedParents = Set<string>

function cacheKey(parentId: string | null, name: string) {
  return `${parentId ?? "root"}/${name}`
}

/**
 * Find an existing folder with the given name under `parentId`, or create one.
 * Existing same-named folders are reused (merge behavior), and newly created
 * folders are cached so siblings within the same dropped tree merge correctly.
 */
async function resolveFolder(
  name: string,
  parentId: string | null,
  cache: FolderCache,
  listed: ListedParents
): Promise<string> {
  const key = cacheKey(parentId, name)
  const cached = cache.get(key)
  if (cached) return cached

  const parentKey = parentId ?? "root"
  if (!listed.has(parentKey)) {
    try {
      const { nodes } = await listDriveNodes({ parentId, view: "my" })
      for (const node of nodes) {
        if (node.type === "folder") {
          const existingKey = cacheKey(parentId, node.name)
          if (!cache.has(existingKey)) cache.set(existingKey, node._id)
        }
      }
    } catch {
      // If listing fails we fall through and create a fresh folder.
    }
    listed.add(parentKey)
  }

  const afterListing = cache.get(key)
  if (afterListing) return afterListing

  const { node } = await createDriveFolder(name, parentId)
  cache.set(key, node._id)
  return node._id
}

function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = []
  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries)
          return
        }
        entries.push(...batch)
        readBatch()
      }, reject)
    }
    readBatch()
  })
}

async function readEntry(
  entry: FileSystemEntry,
  parentId: string | null,
  pathPrefix: string,
  out: FileDescriptor[],
  cache: FolderCache,
  listed: ListedParents
): Promise<void> {
  if (entry.isFile) {
    const file = await getFile(entry as FileSystemFileEntry)
    out.push({ file, name: `${pathPrefix}${file.name}`, parentId })
    return
  }
  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntry
    const folderId = await resolveFolder(dir.name, parentId, cache, listed)
    const children = await readAllDirectoryEntries(dir.createReader())
    for (const child of children) {
      await readEntry(child, folderId, `${pathPrefix}${dir.name}/`, out, cache, listed)
    }
  }
}

/**
 * Build upload descriptors from a native drop: a synchronously-collected list of
 * FileSystemEntry objects (directories recursed) plus any loose files.
 */
export async function buildDescriptorsFromEntries(
  entries: FileSystemEntry[],
  looseFiles: File[],
  targetParentId: string | null
): Promise<FileDescriptor[]> {
  const out: FileDescriptor[] = looseFiles.map((file) => ({
    file,
    name: file.name,
    parentId: targetParentId,
  }))

  if (entries.length) {
    const cache: FolderCache = new Map()
    const listed: ListedParents = new Set()
    for (const entry of entries) {
      await readEntry(entry, targetParentId, "", out, cache, listed)
    }
  }

  return out
}

/**
 * Build upload descriptors from an <input> FileList. Files selected via a
 * webkitdirectory input carry a `webkitRelativePath`, which we use to recreate
 * the folder structure (merging into existing folders).
 */
export async function buildDescriptorsFromFileList(
  files: File[],
  targetParentId: string | null
): Promise<FileDescriptor[]> {
  const cache: FolderCache = new Map()
  const listed: ListedParents = new Set()
  const out: FileDescriptor[] = []

  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? ""
    if (!relativePath || !relativePath.includes("/")) {
      out.push({ file, name: file.name, parentId: targetParentId })
      continue
    }
    const segments = relativePath.split("/")
    const directories = segments.slice(0, -1)
    let parentId = targetParentId
    for (const directory of directories) {
      parentId = await resolveFolder(directory, parentId, cache, listed)
    }
    out.push({ file, name: relativePath, parentId })
  }

  return out
}

export interface DriveUploadsApi {
  tasks: UploadTask[]
  active: boolean
  enqueue: (descriptors: FileDescriptor[]) => void
  dismissFinished: () => void
}

export function useDriveUploads(onAllComplete: () => void): DriveUploadsApi {
  const [tasks, setTasks] = React.useState<UploadTask[]>([])
  const queueRef = React.useRef<UploadTask[]>([])
  const runningRef = React.useRef(false)
  const onCompleteRef = React.useRef(onAllComplete)

  React.useEffect(() => {
    onCompleteRef.current = onAllComplete
  }, [onAllComplete])

  const patch = React.useCallback((id: string, updates: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)))
  }, [])

  const run = React.useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true

    let succeeded = 0
    let failed = 0

    while (queueRef.current.length) {
      const task = queueRef.current.shift()!
      patch(task.id, { status: "uploading", progress: 0 })
      try {
        await uploadDriveFile(task.file, task.parentId, (progress) => patch(task.id, { progress }))
        patch(task.id, { status: "done", progress: 100 })
        succeeded += 1
      } catch (err) {
        patch(task.id, { status: "error", error: err instanceof Error ? err.message : "Upload failed" })
        failed += 1
      }
    }

    runningRef.current = false

    if (succeeded || failed) {
      if (failed === 0) {
        toast.success(succeeded === 1 ? "File uploaded" : `${succeeded} files uploaded`)
      } else if (succeeded === 0) {
        toast.error(failed === 1 ? "Upload failed" : `${failed} uploads failed`)
      } else {
        toast.warning(`${succeeded} uploaded, ${failed} failed`)
      }
    }

    onCompleteRef.current()
  }, [patch])

  const enqueue = React.useCallback(
    (descriptors: FileDescriptor[]) => {
      if (!descriptors.length) return
      const newTasks: UploadTask[] = descriptors.map((descriptor) => ({
        id: crypto.randomUUID(),
        name: descriptor.name,
        parentId: descriptor.parentId,
        file: descriptor.file,
        status: "pending",
        progress: 0,
      }))
      setTasks((prev) => [...prev, ...newTasks])
      queueRef.current.push(...newTasks)
      void run()
    },
    [run]
  )

  const dismissFinished = React.useCallback(() => {
    setTasks((prev) => prev.filter((task) => task.status === "pending" || task.status === "uploading"))
  }, [])

  const active = tasks.some((task) => task.status === "pending" || task.status === "uploading")

  return { tasks, active, enqueue, dismissFinished }
}
