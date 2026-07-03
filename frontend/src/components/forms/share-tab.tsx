import { useCallback } from "react"
import { toCanvas } from "qrcode"
import {
  CodeXmlIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LinkIcon,
  QrCodeIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getFormsShareOrigin } from "@/lib/env"
import { embedSnippet, publicFormUrl } from "@/components/forms/types"

export function ShareTab({
  slug,
  status,
  onSlugChange,
}: {
  slug: string
  status: "draft" | "published" | "archived"
  onSlugChange: (slug: string) => void
}) {
  const url = slug ? publicFormUrl(slug) : ""
  const isPublished = status === "published"

  const renderQrCanvas = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !url) return
      void toCanvas(canvas, url, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 176,
        color: { dark: "#111827", light: "#ffffff" },
      })
    },
    [url],
  )

  async function downloadQrCode() {
    if (!url) return
    const canvas = document.createElement("canvas")
    await toCanvas(canvas, url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1024,
      color: { dark: "#111827", light: "#ffffff" },
    })
    const link = document.createElement("a")
    link.download = `${slug}-qr.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  function copy(value: string, message: string) {
    void navigator.clipboard.writeText(value)
    toast.success(message)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10 lg:px-8">
      {!isPublished && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium">This form is not live yet</p>
            <p className="mt-0.5 text-muted-foreground">
              Publish the form to make the link below work for respondents.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <LinkIcon className="size-4 text-muted-foreground" /> Public Link
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Link slug</Label>
            <div className="flex items-center overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring/50">
              <span className="shrink-0 border-r bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                {getFormsShareOrigin().replace(/^https?:\/\//, "")}/f/
              </span>
              <input
                value={slug}
                onChange={(event) =>
                  onSlugChange(event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))
                }
                className="w-full bg-transparent px-3 py-2 font-mono text-xs outline-none"
                placeholder="my-form"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Changing the slug changes the public link — old links stop working after you save.
            </p>
          </div>

          <div className="flex gap-2">
            <Input readOnly value={url || "Set a slug first"} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!url}
              onClick={() => copy(url, "Link copied")}
            >
              <CopyIcon className="size-3.5" /> Copy
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" disabled={!url} asChild>
              <a href={url || "#"} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" /> Open
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <QrCodeIcon className="size-4 text-muted-foreground" /> QR Code
        </div>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="rounded-lg border bg-white p-2">
            {url ? (
              <canvas key={url} ref={renderQrCanvas} className="size-44" aria-label={`QR code for ${url}`} />
            ) : (
              <div className="flex size-44 items-center justify-center text-xs text-muted-foreground">
                Set a slug first
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Point a phone camera at this code to open the form. Useful for posters, packaging, and
              events.
            </p>
            <Button variant="outline" size="sm" disabled={!url} onClick={() => void downloadQrCode()}>
              <DownloadIcon className="size-3.5" /> Download PNG
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <CodeXmlIcon className="size-4 text-muted-foreground" /> Embed on Your Site
        </div>
        <textarea
          readOnly
          rows={4}
          value={slug ? embedSnippet(slug) : ""}
          className="w-full rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground outline-none"
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={!slug}
          onClick={() => copy(embedSnippet(slug), "Embed code copied")}
        >
          <CopyIcon className="size-3.5" /> Copy Embed Code
        </Button>
      </section>
    </div>
  )
}
