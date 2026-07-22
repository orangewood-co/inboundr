import { cn } from "@/lib/utils"
import type { FormBranding } from "@/components/forms/types"

/**
 * Miniature preview of a folder's design: its background (gradient or solid)
 * with the accent color as a centered dot. Size it via className (e.g. size-9).
 */
export function FolderSwatch({
  branding,
  className,
}: {
  branding: FormBranding
  className?: string
}) {
  const background =
    branding.backgroundType === "gradient" && branding.backgroundGradient
      ? branding.backgroundGradient
      : branding.backgroundType === "solid" && branding.backgroundColor
        ? branding.backgroundColor
        : "#ffffff"

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-black/10 shadow-xs",
        className,
      )}
      style={{ background }}
    >
      <span
        className="h-1/3 w-1/3 rounded-full shadow-sm"
        style={{ backgroundColor: branding.accentColor || "#111827" }}
      />
    </span>
  )
}
