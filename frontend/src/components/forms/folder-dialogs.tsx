import { useEffect, useState } from "react"
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
  onDeleted,
}: {
  folder: FormFolder | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (folder: FormFolder) => void
  onDeleted: (folderId: string) => void
}) {
  const [name, setName] = useState("")
  const [branding, setBranding] = useState<FormBranding>(DEFAULT_FOLDER_BRANDING)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open && folder) {
      setName(folder.name)
      setBranding({ ...DEFAULT_FOLDER_BRANDING, ...folder.branding })
      setConfirmingDelete(false)
    }
  }, [open, folder])

  if (!folder) return null

  async function save() {
    if (!folder) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Folder name is required")
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

  async function remove() {
    if (!folder) return
    setDeleting(true)
    try {
      await apiDeleteFolder(folder._id)
      toast.success("Folder deleted")
      setConfirmingDelete(false)
      onOpenChange(false)
      onDeleted(folder._id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete folder")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Folder Settings</DialogTitle>
            <DialogDescription>
              Forms in this folder inherit this design unless they opt out in their own Design tab.
            </DialogDescription>
          </DialogHeader>

          <div className="max-w-sm space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Folder name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </div>

          <DesignTab
            title={name || "Folder design"}
            description=""
            submitButtonLabel="Start"
            branding={branding}
            onPatchBranding={(patch) => setBranding((current) => ({ ...current, ...patch }))}
          />

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete Folder
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save()}>
                {saving && <Spinner className="size-3.5" data-icon="inline-start" />}
                Save Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDelete} onOpenChange={(next) => !deleting && setConfirmingDelete(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              {`"${folder.name}" will be deleted. Its forms are kept and go back to using their own designs.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
              {deleting ? "Deleting..." : "Delete Folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
