import { type FormEvent, useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  LoaderIcon,
  LockIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ORIGIN } from "@/lib/env"

type SharedNode = {
  _id: string
  type: "file" | "folder"
  name: string
  contentType: string | null
  size: number
}

type SharedLink = {
  allowDownload: boolean
  expiresAt: string | null
}

type ExportJob = {
  _id: string
  status: "queued" | "running" | "completed" | "failed"
  error: string | null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || "This link is not available")
  return data
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function isImage(node: SharedNode) {
  return (node.contentType ?? "").startsWith("image/")
}

function isPdf(node: SharedNode) {
  return node.contentType === "application/pdf"
}

export default function DriveSharePage({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [node, setNode] = useState<SharedNode | null>(null)
  const [link, setLink] = useState<SharedLink | null>(null)
  const [password, setPassword] = useState("")
  const [unlockedPassword, setUnlockedPassword] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)

  const baseUrl = `/api/v1/public/drive/${encodeURIComponent(token)}`

  const passwordQuery = useCallback((pwd: string, extra?: Record<string, string>) => {
    const query = new URLSearchParams(extra)
    if (pwd) query.set("password", pwd)
    const value = query.toString()
    return value ? `?${value}` : ""
  }, [])

  const load = useCallback(
    async (pwd: string) => {
      setError(null)
      try {
        const response = await api<{ locked: boolean; link?: SharedLink; node?: SharedNode }>(
          `${baseUrl}${passwordQuery(pwd)}`
        )
        if (response.locked) {
          setLocked(true)
          if (pwd) setError("Incorrect password")
          return
        }
        setLocked(false)
        setNode(response.node ?? null)
        setLink(response.link ?? null)
        const shared = response.node
        if (shared && shared.type === "file" && (isImage(shared) || isPdf(shared))) {
          try {
            const { url } = await api<{ url: string }>(
              `${baseUrl}/files/${encodeURIComponent(shared._id)}/view-url${passwordQuery(pwd)}`
            )
            setPreviewUrl(url)
          } catch {
            setPreviewUrl(null)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "This link is not available")
      } finally {
        setLoading(false)
      }
    },
    [baseUrl, passwordQuery]
  )

  useEffect(() => {
    void load("")
  }, [load])

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setWorking(true)
    setUnlockedPassword(password)
    await load(password)
    setWorking(false)
  }

  async function downloadFile() {
    if (!node) return
    setWorking(true)
    setError(null)
    try {
      const { url } = await api<{ url: string }>(
        `${baseUrl}/files/${encodeURIComponent(node._id)}/download-url${passwordQuery(unlockedPassword)}`
      )
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download file")
    } finally {
      setWorking(false)
    }
  }

  async function downloadFolder() {
    if (!node) return
    setWorking(true)
    setError(null)
    setExportStatus("Preparing ZIP archive...")
    try {
      const { job } = await api<{ job: ExportJob }>(`${baseUrl}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node._id, password: unlockedPassword || undefined }),
      })
      for (let i = 0; i < 60; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000))
        const response = await api<{ job?: ExportJob }>(
          `${baseUrl}/exports/${encodeURIComponent(job._id)}${passwordQuery(unlockedPassword)}`
        )
        if (response.job?.status === "failed") {
          throw new Error(response.job.error || "Export failed")
        }
        if (response.job?.status === "completed") {
          const result = await api<{ url?: string }>(
            `${baseUrl}/exports/${encodeURIComponent(job._id)}/download${passwordQuery(unlockedPassword)}`
          )
          if (result.url) window.open(result.url, "_blank", "noopener,noreferrer")
          return
        }
      }
      throw new Error("Export timed out. Please try again.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download folder")
    } finally {
      setWorking(false)
      setExportStatus(null)
    }
  }

  const expiresOn = link?.expiresAt
    ? new Date(link.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-stone-200 bg-white p-8 shadow-2xl shadow-stone-900/10">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <LoaderIcon className="size-4 animate-spin" />
            Checking link...
          </div>
        ) : locked ? (
          <form onSubmit={unlock} className="grid gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-stone-900 text-white">
              <LockIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900">Protected share</h1>
              <p className="mt-1 text-sm text-stone-500">Enter the password to access this share.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={working}>
              {working && <LoaderIcon className="size-4 animate-spin" />}
              Continue
            </Button>
          </form>
        ) : error && !node ? (
          <div className="text-center">
            <AlertCircleIcon className="mx-auto size-8 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-stone-900">Share unavailable</h1>
            <p className="mt-2 text-sm text-stone-500">{error}</p>
          </div>
        ) : node && link ? (
          <div className="grid gap-5">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-stone-900 text-white">
                {node.type === "folder" ? <FolderIcon className="size-5" /> : <FileIcon className="size-5" />}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold break-words text-stone-900">{node.name}</h1>
                <p className="mt-1 text-sm text-stone-500">
                  {node.type === "folder" ? "Shared folder" : formatBytes(node.size)}
                  {expiresOn ? ` · Link expires on ${expiresOn}` : ""}
                </p>
              </div>
            </div>

            {previewUrl && node.type === "file" && isImage(node) && (
              <img
                src={previewUrl}
                alt={node.name}
                className="max-h-96 w-full rounded-xl border border-stone-200 object-contain"
              />
            )}
            {previewUrl && node.type === "file" && isPdf(node) && (
              <iframe
                title={node.name}
                src={previewUrl}
                className="h-[28rem] w-full rounded-xl border border-stone-200"
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            {link.allowDownload ? (
              <Button
                onClick={() => void (node.type === "folder" ? downloadFolder() : downloadFile())}
                disabled={working}
              >
                {working ? <LoaderIcon className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
                {exportStatus ?? (node.type === "folder" ? "Download ZIP" : "Download")}
              </Button>
            ) : (
              <p className="text-sm text-stone-500">Downloads are disabled for this link.</p>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}
