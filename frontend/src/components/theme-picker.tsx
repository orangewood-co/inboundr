import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import type { ThemeConfig } from "@/lib/themes"

function ThemeSwatch({
  theme,
  active,
  onClick,
}: {
  theme: ThemeConfig
  active: boolean
  onClick: () => void
}) {
  const primary = theme.dark["--primary"]
  const background = theme.dark["--background"]
  const accent = theme.dark["--accent"]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all hover:bg-muted/50",
        active
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border"
      )}
    >
      <div className="flex h-8 w-full items-center justify-center gap-1 rounded-md overflow-hidden">
        <div
          className="h-full flex-1 rounded-l-md"
          style={{ backgroundColor: primary }}
        />
        <div
          className="h-full flex-1"
          style={{ backgroundColor: accent }}
        />
        <div
          className="h-full flex-1 rounded-r-md"
          style={{ backgroundColor: background }}
        />
      </div>
      <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
        {theme.label}
      </span>
      {active && (
        <div className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary">
          <CheckIcon className="size-2.5 text-primary-foreground" />
        </div>
      )}
    </button>
  )
}

export function ThemePicker({
  value,
  onChange,
  className,
}: {
  value?: string
  onChange?: (themeName: string) => void
  className?: string
}) {
  const { colorTheme, setColorTheme, availableThemes } = useTheme()

  const activeTheme = value ?? colorTheme
  const handleChange = onChange ?? setColorTheme

  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2",
        className
      )}
    >
      {availableThemes.map((theme) => (
        <ThemeSwatch
          key={theme.name}
          theme={theme}
          active={activeTheme === theme.name}
          onClick={() => handleChange(theme.name)}
        />
      ))}
    </div>
  )
}

export function ModeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  const modes = [
    { value: "light" as const, icon: SunIcon, label: "Light" },
    { value: "dark" as const, icon: MoonIcon, label: "Dark" },
    { value: "system" as const, icon: MonitorIcon, label: "System" },
  ]

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border bg-muted/50 p-0.5",
        className
      )}
    >
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => setTheme(m.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            theme === m.value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <m.icon className="size-3.5" />
          {m.label}
        </button>
      ))}
    </div>
  )
}
