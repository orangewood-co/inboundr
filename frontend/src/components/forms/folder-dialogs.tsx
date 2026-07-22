import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  createFolder as apiCreateFolder,
  deleteFolder as apiDeleteFolder,
  updateFolder as apiUpdateFolder,
} from "@/lib/forms-api"
import { DesignTab } from "@/components/forms/design-tab"
import { FolderSwatch } from "@/components/forms/folder-swatch"
import type { FormBranding, FormFolder } from "@/components/forms/types"

const DEFAULT_FOLDER_BRANDING: FormBranding = {
  accentColor: "#111827",
  logoUrl: null,
  backgroundType: "none",
  backgroundColor: null,
  backgroundGradient: null,
  theme: null,
  borderRadius: "md",
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (folder: FormFolder) => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName("")
  }, [open])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const folder = await apiCreateFolder({ name: trimmed, branding: DEFAULT_FOLDER_BRANDING })
      toast.success("Folder created")
      onOpenChange(false)
      onCreated(folder)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Group forms in a folder, then give the folder a design that its forms inherit.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Folder name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Marketing"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
              Create Folder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FolderSettingsDialog({
  folder,
  open,
  onOpenChange,
  onSaved,
  initialFocus = "design",
}: {
  folder: FormFolder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (folder: FormFolder) => void
  /** "name" opens the dialog with the name field focused and selected (Rename). */
  initialFocus?: "design" | "name"
}) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")
  const [branding, setBranding] = useState<FormBranding>(DEFAULT_FOLDER_BRANDING)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && folder) {
      setName(folder.name)
      setBranding({ ...DEFAULT_FOLDER_BRANDING, ...folder.branding })
    }
  }, [open, folder])

  if (!folder) return null

  async function save() {
    if (!folder) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Folder name is required")
      nameInputRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const saved = await apiUpdateFolder(folder._id, { name: trimmed, branding })
      toast.success("Folder saved")
      onOpenChange(false)
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save folder")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-5xl"
        onOpenAutoFocus={(event) => {
          if (initialFocus === "name") {
            event.preventDefault()
            nameInputRef.current?.focus()
            nameInputRef.current?.select()
          }
        }}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Folder Settings</DialogTitle>
          <DialogDescription>
            Forms in this folder inherit this design unless they opt out in their own
            Design tab.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          <div className="flex items-end gap-3">
            <FolderSwatch branding={branding} className="size-9" />
            <div className="w-full max-w-sm space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Folder name</Label>
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
            </div>
          </div>

          <DesignTab
            title={name || "Folder design"}
            description=""
            submitButtonLabel="Start"
            branding={branding}
            onPatchBranding={(patch) => setBranding((current) => ({ ...current, ...patch }))}
          />
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
            Save Folder
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteFolderDialog({
  folder,
  open,
  onOpenChange,
  onDeleted,
}: {
  folder: FormFolder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (folderId: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  if (!folder) return null

  async function remove() {
    if (!folder) return
    setDeleting(true)
    try {
      await apiDeleteFolder(folder._id)
      toast.success("Folder deleted")
      onOpenChange(false)
      onDeleted(folder._id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            {`"${folder.name}" will be deleted. Its forms are kept and go back to using their own designs.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={deleting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
            {deleting ? "Deleting..." : "Delete Folder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
