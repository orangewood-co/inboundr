/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import {
  type ThemeConfig,
  THEME_CSS_VARIABLES,
  DEFAULT_THEME_NAME,
  themes,
  getThemeByName,
} from "@/lib/themes"

type Mode = "dark" | "light" | "system"
type ResolvedMode = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultMode?: Mode
  modeStorageKey?: string
  colorThemeStorageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Mode
  setTheme: (mode: Mode) => void
  colorTheme: string
  setColorTheme: (name: string) => void
  setOrgColorTheme: (name: string | null) => void
  availableThemes: ThemeConfig[]
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const MODE_VALUES: Mode[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isMode(value: string | null): value is Mode {
  if (value === null) return false
  return MODE_VALUES.includes(value as Mode)
}

function getSystemMode(): ResolvedMode {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
}

function resolveMode(mode: Mode): ResolvedMode {
  return mode === "system" ? getSystemMode() : mode
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return !!target.closest("input, textarea, select, [contenteditable='true']")
}

function applyColorThemeToDOM(themeName: string, currentMode: ResolvedMode) {
  const root = document.documentElement

  THEME_CSS_VARIABLES.forEach((v) => root.style.removeProperty(v))

  if (themeName === DEFAULT_THEME_NAME) return

  const config = getThemeByName(themeName)
  if (!config) return

  const values = currentMode === "dark" ? config.dark : config.light
  for (const [variable, value] of Object.entries(values)) {
    if (value !== undefined) {
      root.style.setProperty(variable, value)
    }
  }
}

function applyModeToDOM(
  mode: Mode,
  disableTransitions: boolean
): ResolvedMode {
  const root = document.documentElement
  const resolved = resolveMode(mode)
  const restoreTransitions = disableTransitions
    ? disableTransitionsTemporarily()
    : null

  root.classList.remove("light", "dark")
  root.classList.add(resolved)

  restoreTransitions?.()
  return resolved
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  modeStorageKey = "theme",
  colorThemeStorageKey = "user-color-theme",
  disableTransitionOnChange = true,
  ...props
}: ThemeProviderProps) {
  const [mode, setModeState] = React.useState<Mode>(() => {
    const stored = localStorage.getItem(modeStorageKey)
    return isMode(stored) ? stored : defaultMode
  })

  const [userColorTheme, setUserColorThemeState] = React.useState<
    string | null
  >(() => localStorage.getItem(colorThemeStorageKey))

  const [orgColorTheme, setOrgColorThemeState] = React.useState<string | null>(
    null
  )

  const resolvedColorTheme =
    userColorTheme ?? orgColorTheme ?? DEFAULT_THEME_NAME

  const setTheme = React.useCallback(
    (nextMode: Mode) => {
      localStorage.setItem(modeStorageKey, nextMode)
      setModeState(nextMode)
    },
    [modeStorageKey]
  )

  const setColorTheme = React.useCallback(
    (name: string) => {
      if (name === DEFAULT_THEME_NAME && orgColorTheme === null) {
        localStorage.removeItem(colorThemeStorageKey)
        setUserColorThemeState(null)
      } else {
        localStorage.setItem(colorThemeStorageKey, name)
        setUserColorThemeState(name)
      }
    },
    [colorThemeStorageKey, orgColorTheme]
  )

  const setOrgColorTheme = React.useCallback(
    (name: string | null) => {
      setOrgColorThemeState(name)
    },
    []
  )

  React.useEffect(() => {
    const resolved = applyModeToDOM(mode, disableTransitionOnChange)
    applyColorThemeToDOM(resolvedColorTheme, resolved)

    if (mode !== "system") return undefined

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      const newResolved = applyModeToDOM("system", disableTransitionOnChange)
      applyColorThemeToDOM(resolvedColorTheme, newResolved)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [mode, resolvedColorTheme, disableTransitionOnChange])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      if (event.key.toLowerCase() !== "d") return

      setModeState((current) => {
        const next =
          current === "dark"
            ? "light"
            : current === "light"
              ? "dark"
              : getSystemMode() === "dark"
                ? "light"
                : "dark"

        localStorage.setItem(modeStorageKey, next)
        return next
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [modeStorageKey])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return

      if (event.key === modeStorageKey) {
        setModeState(isMode(event.newValue) ? event.newValue : defaultMode)
      }

      if (event.key === colorThemeStorageKey) {
        setUserColorThemeState(event.newValue)
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [defaultMode, modeStorageKey, colorThemeStorageKey])

  const value = React.useMemo(
    () => ({
      theme: mode,
      setTheme,
      colorTheme: resolvedColorTheme,
      setColorTheme,
      setOrgColorTheme,
      availableThemes: themes,
    }),
    [mode, setTheme, resolvedColorTheme, setColorTheme, setOrgColorTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
