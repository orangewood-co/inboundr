import * as React from "react"
import { useParams } from "@tanstack/react-router"
import { toast } from "sonner"
import { DownloadIcon, FileIcon, FolderIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  createPublicDriveExport,
  formatBytes,
  getPublicDriveExport,
  getPublicDriveFileUrl,
  getPublicDriveLink,
  listPublicDriveChildren,
  type DriveNode,
} from "@/lib/drive"

export default function DriveSharePage() {
  const { token } = useParams({ from: "/drive/share/$token" })
  const [password, setPassword] = React.useState("")
  const [unlockedPassword, setUnlockedPassword] = React.useState("")
  const [locked, setLocked] = React.useState(false)
  const [root, setRoot] = React.useState<DriveNode | null>(null)
  const [parent, setParent] = React.useState<DriveNode | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<DriveNode[]>([])
  const [nodes, setNodes] = React.useState<DriveNode[]>([])
  const [viewer, setViewer] = React.useState<{ node: DriveNode; url: string } | null>(null)

  const load = React.useCallback(async (nextPassword = unlockedPassword) => {
    try {
      const response = await getPublicDriveLink(token, nextPassword)
      setLocked(response.locked)
      if (response.node) {
        setRoot(response.node)
        setParent(response.node.type === "folder" ? response.node : null)
        if (response.node.type === "folder") {
          const children = await listPublicDriveChildren(token, response.node._id, nextPassword)
          setNodes(children.nodes)
        } else {
          setNodes([response.node])
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Shared link not found")
    }
  }, [token, unlockedPassword])

  React.useEffect(() => {
    void load()
  }, [load])

  async function unlock() {
    setUnlockedPassword(password)
    await load(password)
  }

  async function openFolder(node: DriveNode) {
    const children = await listPublicDriveChildren(token, node._id, unlockedPassword)
    setNodes(children.nodes)
    setParent(node)
    setBreadcrumbs((items) => [...items, node])
  }

  async function openFile(node: DriveNode, download = false) {
    const { url } = await getPublicDriveFileUrl(token, node._id, unlockedPassword, download)
    if (download) {
      window.open(url, "_blank", "noopener,noreferrer")
    } else {
      setViewer({ node, url })
    }
  }

  async function downloadFolder(node: DriveNode) {
    const { job } = await createPublicDriveExport(token, node._id, unlockedPassword)
    toast.info("Folder ZIP export started")
    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
      const response = await getPublicDriveExport(token, job._id, unlockedPassword)
      if (response.job?.status === "failed") {
        toast.error(response.job.error || "Export failed")
        return
      }
      if (response.job?.status === "completed") {
        const result = await getPublicDriveExport(token, job._id, unlockedPassword, true)
        if (result.url) window.open(result.url, "_blank", "noopener,noreferrer")
        return
      }
    }
  }

  if (locked) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
          <LockIcon className="mb-4 size-8 text-primary" />
          <h1 className="font-heading text-xl font-semibold">Password required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter the password shared with this Drive link.</p>
          <Input className="mt-4" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Button className="mt-4 w-full" onClick={() => void unlock()}>Unlock</Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-semibold">{root?.name ?? "Shared Drive item"}</h1>
              <p className="text-sm text-muted-foreground">Public view-only Drive share</p>
            </div>
            {root?.type === "folder" && (
              <Button onClick={() => root && void downloadFolder(parent ?? root)}>
                <DownloadIcon className="size-4" />
                Download ZIP
              </Button>
            )}
          </div>

          {root?.type === "folder" && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => { setParent(root); setBreadcrumbs([]); void listPublicDriveChildren(token, root._id, unlockedPassword).then((res) => setNodes(res.nodes)) }}>Shared folder</button>
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb._id}>
                  <span>/</span>
                  <button onClick={() => { setParent(crumb); setBreadcrumbs(breadcrumbs.slice(0, index + 1)); void listPublicDriveChildren(token, crumb._id, unlockedPassword).then((res) => setNodes(res.nodes)) }}>{crumb.name}</button>
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="mt-5 divide-y rounded-lg border">
            {nodes.map((node) => (
              <div key={node._id} className="flex items-center justify-between gap-3 p-3">
                <button className="flex items-center gap-2 text-left font-medium hover:text-primary" onClick={() => node.type === "folder" ? void openFolder(node) : void openFile(node)}>
                  {node.type === "folder" ? <FolderIcon className="size-4 text-primary" /> : <FileIcon className="size-4 text-muted-foreground" />}
                  <span>{node.name}</span>
                </button>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{node.type === "folder" ? "Folder" : formatBytes(node.size)}</span>
                  <Button variant="ghost" size="sm" onClick={() => node.type === "folder" ? void downloadFolder(node) : void openFile(node, true)}>
                    <DownloadIcon className="size-4" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Dialog open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="max-h-[90svh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{viewer?.node.name}</DialogTitle>
          </DialogHeader>
          {viewer && <iframe title={viewer.node.name} src={viewer.url} className="h-[70svh] w-full rounded-lg border" />}
        </DialogContent>
      </Dialog>
    </main>
  )
}
