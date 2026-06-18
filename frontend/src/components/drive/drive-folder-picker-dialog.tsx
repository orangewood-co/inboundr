import * as React from "react"
import { ChevronRightIcon, FolderIcon, FolderPlusIcon, HardDriveIcon, LoaderIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { createDriveFolder, getDriveNode, listDriveNodes, type DriveNode } from "@/lib/drive"
import { cn } from "@/lib/utils"

type FolderDestination = {
  id: string | null
  name: string
}

export function DriveFolderPickerDialog({
  open,
  onOpenChange,
  onSelectFolder,
  title = "Save to Drive",
  description = "Choose where this file should be saved.",
  confirmLabel = "Save Here",
  initialFolderId = null,
  busy = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectFolder: (folder: FolderDestination) => void | Promise<void>
  title?: string
  description?: string
  confirmLabel?: string
  initialFolderId?: string | null
  busy?: boolean
}) {
  const [currentFolder, setCurrentFolder] = React.useState<DriveNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<DriveNode[]>([])
  const [folders, setFolders] = React.useState<DriveNode[]>([])
  const [loading, setLoading] = React.useState(false)
  const [newFolderOpen, setNewFolderOpen] = React.useState(false)
  const [creatingFolder, setCreatingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const currentDestination: FolderDestination = currentFolder
    ? { id: currentFolder._id, name: currentFolder.name }
    : { id: null, name: "Drive" }

  const loadFolders = React.useCallback(async (parentId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const response = await listDriveNodes({
        parentId,
        view: "my",
        types: ["folders"],
        sort: "name",
        dir: "asc",
      })
      setFolders(response.nodes.filter((node) => node.type === "folder"))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Drive folders")
      setFolders([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    let cancelled = false

    async function reset() {
      setError(null)
      setNewFolderName("")
      setNewFolderOpen(false)
      setCreatingFolder(false)
      if (!initialFolderId) {
        setCurrentFolder(null)
        setBreadcrumbs([])
        await loadFolders(null)
        return
      }

      try {
        const { node } = await getDriveNode(initialFolderId)
        if (cancelled) return
        if (node.type === "folder") {
          setCurrentFolder(node)
          setBreadcrumbs([node])
          await loadFolders(node._id)
        } else {
          setCurrentFolder(null)
          setBreadcrumbs([])
          await loadFolders(null)
        }
      } catch {
        if (cancelled) return
        setCurrentFolder(null)
        setBreadcrumbs([])
        await loadFolders(null)
      }
    }

    void reset()
    return () => {
      cancelled = true
    }
  }, [initialFolderId, loadFolders, open])

  function enterFolder(folder: DriveNode) {
    setCurrentFolder(folder)
    setBreadcrumbs((current) => [...current, folder])
    setNewFolderName("")
    setNewFolderOpen(false)
    void loadFolders(folder._id)
  }

  function jumpToRoot() {
    setCurrentFolder(null)
    setBreadcrumbs([])
    setNewFolderName("")
    setNewFolderOpen(false)
    void loadFolders(null)
  }

  function jumpToCrumb(index: number) {
    const folder = breadcrumbs[index]
    if (!folder) return
    setCurrentFolder(folder)
    setBreadcrumbs((current) => current.slice(0, index + 1))
    setNewFolderName("")
    setNewFolderOpen(false)
    void loadFolders(folder._id)
  }

  async function createFolderAndEnter() {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    setError(null)
    try {
      const { node } = await createDriveFolder(name, currentFolder?._id ?? null)
      setNewFolderName("")
      enterFolder(node)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[82svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
            <Button variant="ghost" size="xs" className="h-7 px-1.5" onClick={jumpToRoot}>
              <HardDriveIcon className="size-3.5" />
              Drive
            </Button>
            {breadcrumbs.map((folder, index) => (
              <React.Fragment key={folder._id}>
                <ChevronRightIcon className="size-3.5" />
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 max-w-40 px-1.5"
                  onClick={() => jumpToCrumb(index)}
                >
                  <span className="truncate">{folder.name}</span>
                </Button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{currentDestination.name}</p>
              <p className="text-xs text-muted-foreground">Current destination</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewFolderOpen((value) => !value)}
                disabled={busy}
              >
                <FolderPlusIcon className="size-3.5" />
                New folder
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void loadFolders(currentFolder?._id ?? null)}
                disabled={loading || busy}
                aria-label="Refresh folders"
              >
                <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {newFolderOpen && (
            <div className="grid gap-2 border-b bg-muted/20 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void createFolderAndEnter()
                  }
                }}
                placeholder="Folder name"
                disabled={busy || creatingFolder}
              />
              <Button onClick={() => void createFolderAndEnter()} disabled={busy || creatingFolder || !newFolderName.trim()}>
                {creatingFolder && <Spinner data-icon="inline-start" />}
                Create
              </Button>
            </div>
          )}

          <div className="min-h-64 flex-1 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <Spinner className="size-5" />
                Loading folders...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : folders.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <FolderIcon className="size-8 opacity-50" />
                <p>No folders here yet.</p>
                <p className="text-xs">Create a folder, or save directly to this location.</p>
              </div>
            ) : (
              <div className="grid gap-1">
                {folders.map((folder) => (
                  <button
                    key={folder._id}
                    type="button"
                    onClick={() => enterFolder(folder)}
                    className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FolderIcon className="size-4 shrink-0 text-sky-500" />
                      <span className="truncate text-sm font-medium">{folder.name}</span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onSelectFolder(currentDestination)} disabled={busy}>
            {busy && <LoaderIcon className="size-4 animate-spin" data-icon="inline-start" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
