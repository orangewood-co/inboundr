import * as React from "react"
import { toast } from "sonner"
import {
  DownloadIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  LinkIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  SearchIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"

import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  canPreview,
  createDriveExport,
  createDriveFolder,
  createDrivePublicLink,
  formatBytes,
  getDriveExport,
  getDriveFileUrl,
  listDriveNodes,
  listDrivePublicLinks,
  listDriveShares,
  moveDriveNode,
  permanentlyDeleteDriveNode,
  renameDriveNode,
  restoreDriveNode,
  revokeDrivePublicLink,
  shareDriveNode,
  trashDriveNode,
  unshareDriveNode,
  uploadDriveFile,
  type DriveNode,
  type DrivePublicLink,
  type DriveShare,
} from "@/lib/drive"

type DriveView = "my" | "shared" | "trash"

export default function DrivePage() {
  const [nodes, setNodes] = React.useState<DriveNode[]>([])
  const [view, setView] = React.useState<DriveView>("my")
  const [parent, setParent] = React.useState<DriveNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<DriveNode[]>([])
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [viewer, setViewer] = React.useState<{ node: DriveNode; url: string } | null>(null)
  const [sharingNode, setSharingNode] = React.useState<DriveNode | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const loadNodes = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await listDriveNodes({
        parentId: view === "my" ? parent?._id : null,
        view,
        search,
      })
      setNodes(response.nodes)
    } catch (err: any) {
      toast.error(err.message || "Failed to load Drive")
    } finally {
      setLoading(false)
    }
  }, [parent?._id, search, view])

  React.useEffect(() => {
    void loadNodes()
  }, [loadNodes])

  function openFolder(node: DriveNode) {
    setView("my")
    setParent(node)
    setBreadcrumbs((items) => [...items, node])
  }

  function jumpToCrumb(index: number) {
    if (index < 0) {
      setParent(null)
      setBreadcrumbs([])
      return
    }
    const next = breadcrumbs[index]
    setParent(next)
    setBreadcrumbs(breadcrumbs.slice(0, index + 1))
  }

  async function handleUpload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setUploadProgress(0)
    try {
      await uploadDriveFile(file, parent?._id ?? null, setUploadProgress)
      toast.success("File uploaded")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function openViewer(node: DriveNode) {
    try {
      const { url } = await getDriveFileUrl(node._id)
      setViewer({ node, url })
    } catch (err: any) {
      toast.error(err.message || "Unable to preview file")
    }
  }

  async function downloadNode(node: DriveNode) {
    try {
      if (node.type === "folder") {
        const { job } = await createDriveExport(node._id)
        toast.info("Folder ZIP export started")
        pollExport(job._id)
        return
      }
      const { url } = await getDriveFileUrl(node._id, true)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err: any) {
      toast.error(err.message || "Download failed")
    }
  }

  async function pollExport(jobId: string) {
    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
      const { job } = await getDriveExport(jobId)
      if (job?.status === "failed") {
        toast.error(job.error || "Folder export failed")
        return
      }
      if (job?.status === "completed") {
        const result = await getDriveExport(jobId, true)
        if (result.url) window.open(result.url, "_blank", "noopener,noreferrer")
        return
      }
    }
    toast.info("Export is still running. Try download again shortly.")
  }

  async function createFolder() {
    const name = window.prompt("Folder name")
    if (!name?.trim()) return
    try {
      await createDriveFolder(name, parent?._id ?? null)
      toast.success("Folder created")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder")
    }
  }

  async function renameNode(node: DriveNode) {
    const name = window.prompt("New name", node.name)
    if (!name?.trim() || name === node.name) return
    try {
      await renameDriveNode(node._id, name)
      toast.success("Renamed")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Rename failed")
    }
  }

  async function moveNode(node: DriveNode) {
    const parentId = window.prompt("Destination folder ID. Leave empty for root.")
    if (parentId === null) return
    try {
      await moveDriveNode(node._id, parentId.trim() || null)
      toast.success("Moved")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Move failed")
    }
  }

  async function removeNode(node: DriveNode) {
    try {
      if (view === "trash") {
        if (!window.confirm(`Permanently delete ${node.name}? This cannot be undone.`)) return
        await permanentlyDeleteDriveNode(node._id)
        toast.success("Deleted permanently")
      } else {
        await trashDriveNode(node._id)
        toast.success("Moved to Trash")
      }
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Delete failed")
    }
  }

  async function restoreNode(node: DriveNode) {
    try {
      await restoreDriveNode(node._id)
      toast.success("Restored")
      await loadNodes()
    } catch (err: any) {
      toast.error(err.message || "Restore failed")
    }
  }

  return (
    <AppLayout>
      <div className="flex h-svh flex-col overflow-hidden p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold">Drive</h1>
            <p className="text-sm text-muted-foreground">Store, preview, organize, and share organization files.</p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => void handleUpload(event.target.files)} />
            <Button variant="outline" onClick={createFolder}>
              <FolderIcon className="size-4" />
              New folder
            </Button>
            <Button onClick={() => fileInputRef.current?.click()}>
              <UploadIcon className="size-4" />
              Upload
            </Button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {(["my", "shared", "trash"] as DriveView[]).map((item) => (
            <Button key={item} variant={view === item ? "default" : "outline"} size="sm" onClick={() => { setView(item); setParent(null); setBreadcrumbs([]) }}>
              {item === "my" ? "My files" : item === "shared" ? "Shared with me" : "Trash"}
            </Button>
          ))}
          <div className="relative ml-auto min-w-64">
            <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Drive" className="pl-9" />
          </div>
        </div>

        {view === "my" && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button className="hover:text-foreground" onClick={() => jumpToCrumb(-1)}>Drive</button>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb._id}>
                <span>/</span>
                <button className="hover:text-foreground" onClick={() => jumpToCrumb(index)}>{crumb.name}</button>
              </React.Fragment>
            ))}
          </div>
        )}

        {uploadProgress !== null && (
          <div className="mt-4 rounded-lg border bg-card p-3 text-sm">
            Uploading file: {uploadProgress}%
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => (
                <TableRow key={node._id}>
                  <TableCell>
                    <button
                      className="flex items-center gap-2 font-medium hover:text-primary"
                      onClick={() => node.type === "folder" ? openFolder(node) : canPreview(node) ? void openViewer(node) : void downloadNode(node)}
                    >
                      {node.type === "folder" ? <FolderIcon className="size-4 text-primary" /> : <FileIcon className="size-4 text-muted-foreground" />}
                      {node.name}
                    </button>
                  </TableCell>
                  <TableCell>{node.type === "folder" ? "Folder" : node.contentType || "File"}</TableCell>
                  <TableCell>{node.type === "folder" ? "-" : formatBytes(node.size)}</TableCell>
                  <TableCell>{node.role ?? "viewer"}</TableCell>
                  <TableCell>{new Date(node.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {node.type === "file" && canPreview(node) && (
                          <DropdownMenuItem onClick={() => void openViewer(node)}>
                            <EyeIcon className="size-4" />
                            Preview
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => void downloadNode(node)}>
                          <DownloadIcon className="size-4" />
                          Download
                        </DropdownMenuItem>
                        {view !== "trash" && (
                          <>
                            <DropdownMenuItem onClick={() => renameNode(node)}>Rename</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moveNode(node)}>Move</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSharingNode(node)}>
                              <Share2Icon className="size-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {view === "trash" ? (
                          <DropdownMenuItem onClick={() => void restoreNode(node)}>
                            <RotateCcwIcon className="size-4" />
                            Restore
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem variant="destructive" onClick={() => void removeNode(node)}>
                          <Trash2Icon className="size-4" />
                          {view === "trash" ? "Delete forever" : "Move to Trash"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && nodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No Drive items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <FileViewerDialog viewer={viewer} onOpenChange={(open) => !open && setViewer(null)} />
      <ShareDialog node={sharingNode} onOpenChange={(open) => !open && setSharingNode(null)} />
    </AppLayout>
  )
}

function FileViewerDialog({ viewer, onOpenChange }: { viewer: { node: DriveNode; url: string } | null; onOpenChange: (open: boolean) => void }) {
  const type = viewer?.node.contentType ?? ""
  return (
    <Dialog open={Boolean(viewer)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{viewer?.node.name}</DialogTitle>
          <DialogDescription>{type || "File preview"}</DialogDescription>
        </DialogHeader>
        {viewer && (
          <div className="h-[70svh] overflow-hidden rounded-lg border bg-background">
            {type.startsWith("image/") ? (
              <img src={viewer.url} alt={viewer.node.name} className="h-full w-full object-contain" />
            ) : type.startsWith("video/") ? (
              <video src={viewer.url} controls className="h-full w-full" />
            ) : type.startsWith("audio/") ? (
              <div className="flex h-full items-center justify-center p-6">
                <audio src={viewer.url} controls className="w-full" />
              </div>
            ) : (
              <iframe title={viewer.node.name} src={viewer.url} className="h-full w-full" />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ShareDialog({ node, onOpenChange }: { node: DriveNode | null; onOpenChange: (open: boolean) => void }) {
  const [shares, setShares] = React.useState<DriveShare[]>([])
  const [links, setLinks] = React.useState<DrivePublicLink[]>([])
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<"viewer" | "editor">("viewer")
  const [password, setPassword] = React.useState("")

  const refresh = React.useCallback(async () => {
    if (!node) return
    try {
      const [shareResponse, linkResponse] = await Promise.all([listDriveShares(node._id), listDrivePublicLinks(node._id)])
      setShares(shareResponse.shares)
      setLinks(linkResponse.links)
    } catch (err: any) {
      toast.error(err.message || "Failed to load sharing")
    }
  }, [node])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function addShare() {
    if (!node || !email.trim()) return
    try {
      await shareDriveNode(node._id, { email, role })
      setEmail("")
      toast.success("User shared")
      await refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to share")
    }
  }

  async function createLink() {
    if (!node) return
    try {
      const { link } = await createDrivePublicLink(node._id, { password: password || undefined })
      setPassword("")
      await navigator.clipboard.writeText(link.shareUrl)
      toast.success("Public link copied")
      await refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to create public link")
    }
  }

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share {node?.name}</DialogTitle>
          <DialogDescription>Internal editors can modify content. Public links are view-only and expire in 30 days by default.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Share with organization user</Label>
            <div className="flex gap-2">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" />
              <select className="rounded-md border bg-background px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as "viewer" | "editor")}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button onClick={() => void addShare()}>Share</Button>
            </div>
            <div className="space-y-2">
              {shares.map((share) => (
                <div key={share.userId} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{share.user?.email ?? share.userId} · {share.role}</span>
                  <Button variant="ghost" size="sm" onClick={() => node && void unshareDriveNode(node._id, share.userId).then(refresh)}>Remove</Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Public view link</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Optional password" />
              <Button onClick={() => void createLink()}>
                <LinkIcon className="size-4" />
                Create
              </Button>
            </div>
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link._id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <button className="truncate text-left hover:text-primary" onClick={() => void navigator.clipboard.writeText(link.shareUrl).then(() => toast.success("Copied"))}>{link.shareUrl}</button>
                  <Button variant="ghost" size="sm" onClick={() => node && void revokeDrivePublicLink(node._id, link._id).then(refresh)}>Revoke</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
