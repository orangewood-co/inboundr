import { useEffect, useState } from "react"
import { ImageIcon } from "lucide-react"

import { resolveAssetImageUrl } from "@/lib/assets"
import { cn } from "@/lib/utils"

interface AssetImageState {
  key: string
  url: string | null
  failed: boolean
}

/** Renders an asset photo from its S3 key, lazily resolving the presigned URL. */
export function AssetImage({
  imageKey,
  alt,
  className,
  imgClassName,
}: {
  imageKey: string
  alt: string
  className?: string
  imgClassName?: string
}) {
  const [state, setState] = useState<AssetImageState>({
    key: imageKey,
    url: null,
    failed: false,
  })

  // Render-phase reset when the key prop changes (see "You Might Not Need an Effect").
  if (state.key !== imageKey) {
    setState({ key: imageKey, url: null, failed: false })
  }

  useEffect(() => {
    let cancelled = false

    void resolveAssetImageUrl(imageKey)
      .then((resolved) => {
        if (cancelled) return
        setState((current) =>
          current.key === imageKey ? { ...current, url: resolved } : current
        )
      })
      .catch(() => {
        if (cancelled) return
        setState((current) =>
          current.key === imageKey ? { ...current, failed: true } : current
        )
      })

    return () => {
      cancelled = true
    }
  }, [imageKey])

  const ready = state.key === imageKey && state.url && !state.failed

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-muted",
        className
      )}
    >
      {ready ? (
        <img
          src={state.url!}
          alt={alt}
          className={cn("size-full object-cover", imgClassName)}
          onError={() =>
            setState((current) =>
              current.key === imageKey ? { ...current, failed: true } : current
            )
          }
        />
      ) : (
        <ImageIcon
          className={cn(
            "size-4 text-muted-foreground/50",
            !state.failed && "animate-pulse"
          )}
        />
      )}
    </div>
  )
}
