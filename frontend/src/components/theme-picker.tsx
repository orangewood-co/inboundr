import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import type { ThemeConfig } from "@/lib/themes"

function ThemeSwatch({
  theme,
  mode,
}: {
  theme: ThemeConfig
  mode: "light" | "dark"
}) {
  const palette = mode === "dark" ? theme.dark : theme.light

  return (
    <span className="flex h-4 w-9 shrink-0 overflow-hidden rounded-sm border">
      <span className="flex-1" style={{ backgroundColor: palette["--primary"] }} />
      <span className="flex-1" style={{ backgroundColor: palette["--accent"] }} />
      <span className="flex-1" style={{ backgroundColor: palette["--background"] }} />
    </span>
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
  const { theme: mode, colorTheme, setColorTheme, availableThemes } = useTheme()

  const activeTheme = value ?? colorTheme
  const handleChange = onChange ?? setColorTheme
  const resolvedMode =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode

  return (
    <Select value={activeTheme} onValueChange={handleChange}>
      <SelectTrigger className={cn("w-56", className)}>
        <SelectValue placeholder="Select a Theme" />
      </SelectTrigger>
      <SelectContent>
        {availableThemes.map((theme) => (
          <SelectItem key={theme.name} value={theme.name}>
            <ThemeSwatch theme={theme} mode={resolvedMode} />
            {theme.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
