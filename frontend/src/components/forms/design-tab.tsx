import { ArrowRightIcon, CheckIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  THEME_PRESETS,
  type FormBranding,
} from "@/components/forms/types"

export function DesignTab({
  title,
  description,
  submitButtonLabel,
  branding,
  onPatchBranding,
}: {
  title: string
  description: string
  submitButtonLabel: string
  branding: FormBranding
  onPatchBranding: (patch: Partial<FormBranding>) => void
}) {
  function applyTheme(themeId: string) {
    const preset = THEME_PRESETS.find((theme) => theme.id === themeId)
    if (!preset) return
    onPatchBranding({
      theme: themeId,
      accentColor: preset.accent,
      backgroundType: preset.gradient ? "gradient" : preset.bg === "#ffffff" ? "none" : "solid",
      backgroundColor: preset.bg === "#ffffff" ? null : preset.bg,
      backgroundGradient: preset.gradient,
    })
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8">
      {/* Controls */}
      <div className="space-y-8">
        <section>
          <SectionTitle title="Theme" description="Start from a preset, then fine-tune below." />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {THEME_PRESETS.map((preset) => {
              const isActive = branding.theme === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyTheme(preset.id)}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-lg border p-3 transition-all",
                    isActive
                      ? "border-foreground shadow-sm"
                      : "border-border/60 hover:border-muted-foreground/40 hover:bg-muted/40",
                  )}
                >
                  <span
                    className="flex h-10 w-full items-center justify-center rounded-md border border-black/5"
                    style={{ background: preset.gradient ?? preset.bg }}
                  >
                    <span
                      className="flex size-5 items-center justify-center rounded-full shadow-sm"
                      style={{ backgroundColor: preset.accent }}
                    >
                      {isActive && <CheckIcon className="size-3 text-white" />}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">{preset.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <SectionTitle title="Accent Color" description="Buttons and highlights in the public form." />
          <div className="mt-3 flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={branding.accentColor}
                onChange={(event) => onPatchBranding({ accentColor: event.target.value, theme: null })}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div
                className="size-9 rounded-lg border shadow-sm"
                style={{ backgroundColor: branding.accentColor }}
              />
            </div>
            <Input
              value={branding.accentColor}
              onChange={(event) => onPatchBranding({ accentColor: event.target.value, theme: null })}
              className="w-28 font-mono text-xs"
            />
          </div>
        </section>

        <section>
          <SectionTitle title="Background" description="The page behind your form." />
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["none", "solid", "gradient"] as const).map((type) => {
                const isActive =
                  branding.backgroundType === type || (!branding.backgroundType && type === "none")
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onPatchBranding({ backgroundType: type, theme: null })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-[13px] font-medium capitalize transition-all",
                      isActive
                        ? "border-foreground bg-foreground/5"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {type === "none" ? "White" : type}
                  </button>
                )
              })}
            </div>

            {branding.backgroundType === "solid" && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={branding.backgroundColor ?? "#f5f5f4"}
                    onChange={(event) =>
                      onPatchBranding({ backgroundColor: event.target.value, theme: null })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <div
                    className="size-9 rounded-lg border shadow-sm"
                    style={{ backgroundColor: branding.backgroundColor ?? "#f5f5f4" }}
                  />
                </div>
                <Input
                  value={branding.backgroundColor ?? "#f5f5f4"}
                  onChange={(event) =>
                    onPatchBranding({ backgroundColor: event.target.value, theme: null })
                  }
                  className="w-28 font-mono text-xs"
                />
              </div>
            )}

            {branding.backgroundType === "gradient" && (
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">CSS gradient</Label>
                <Input
                  value={branding.backgroundGradient ?? "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)"}
                  onChange={(event) =>
                    onPatchBranding({ backgroundGradient: event.target.value, theme: null })
                  }
                  placeholder="linear-gradient(135deg, #e0f2fe, #bae6fd)"
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionTitle title="Corners" description="Border radius for cards and buttons." />
          <div className="mt-3 grid max-w-sm grid-cols-3 gap-2">
            {([
              { value: "sm" as const, label: "Sharp", radius: "4px" },
              { value: "md" as const, label: "Rounded", radius: "12px" },
              { value: "lg" as const, label: "Pill", radius: "24px" },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPatchBranding({ borderRadius: option.value, theme: null })}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-3 transition-all",
                  (branding.borderRadius ?? "md") === option.value
                    ? "border-foreground bg-foreground/5"
                    : "border-border/60 text-muted-foreground hover:bg-muted/40",
                )}
              >
                <div className="h-6 w-12 border-2 border-current" style={{ borderRadius: option.radius }} />
                <span className="text-[11px] font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Logo" description="Shown at the top of the public form." />
          <div className="mt-3 space-y-1.5">
            <Label className="text-[13px] text-muted-foreground">Logo URL</Label>
            <Input
              value={branding.logoUrl ?? ""}
              onChange={(event) => onPatchBranding({ logoUrl: event.target.value || null })}
              placeholder="https://example.com/logo.png"
              className="text-xs"
            />
          </div>
        </section>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          Live Preview
        </p>
        <WelcomePreview
          title={title}
          description={description}
          submitButtonLabel={submitButtonLabel}
          branding={branding}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          This is how the welcome screen looks to respondents.
        </p>
      </div>
    </div>
  )
}

function WelcomePreview({
  title,
  description,
  submitButtonLabel,
  branding,
}: {
  title: string
  description: string
  submitButtonLabel: string
  branding: FormBranding
}) {
  const radius =
    branding.borderRadius === "sm" ? "6px" : branding.borderRadius === "lg" ? "28px" : "16px"
  const buttonRadius =
    branding.borderRadius === "sm" ? "4px" : branding.borderRadius === "lg" ? "9999px" : "10px"
  const background =
    branding.backgroundType === "gradient" && branding.backgroundGradient
      ? branding.backgroundGradient
      : branding.backgroundType === "solid" && branding.backgroundColor
        ? branding.backgroundColor
        : "#ffffff"
  const initials =
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "F"

  return (
    <div
      className="flex items-center justify-center overflow-hidden border px-6 py-12 shadow-sm"
      style={{ background, borderRadius: radius }}
    >
      <div className="flex max-w-[260px] flex-col items-center text-center">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            className="mb-5 size-14 rounded-xl bg-white object-contain shadow-md"
          />
        ) : (
          <div
            className="mb-5 flex size-14 items-center justify-center rounded-xl text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: branding.accentColor }}
          >
            {initials}
          </div>
        )}
        <p className="text-lg font-bold tracking-tight text-stone-900">
          {title || "Untitled form"}
        </p>
        {description && (
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-stone-500">{description}</p>
        )}
        <div
          className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md"
          style={{ backgroundColor: branding.accentColor, borderRadius: buttonRadius }}
        >
          {submitButtonLabel || "Start"}
          <ArrowRightIcon className="size-3.5" />
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
    </div>
  )
}
