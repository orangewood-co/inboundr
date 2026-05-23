interface ThemeColorVars {
  "--background": string
  "--foreground": string
  "--card": string
  "--card-foreground": string
  "--popover": string
  "--popover-foreground": string
  "--primary": string
  "--primary-foreground": string
  "--secondary": string
  "--secondary-foreground": string
  "--muted": string
  "--muted-foreground": string
  "--accent": string
  "--accent-foreground": string
  "--destructive": string
  "--border": string
  "--input": string
  "--ring": string
  "--chart-1": string
  "--chart-2": string
  "--chart-3": string
  "--chart-4": string
  "--chart-5": string
  "--sidebar": string
  "--sidebar-foreground": string
  "--sidebar-primary": string
  "--sidebar-primary-foreground": string
  "--sidebar-accent": string
  "--sidebar-accent-foreground": string
  "--sidebar-border": string
  "--sidebar-ring": string
}

interface ThemeStyleVars {
  "--destructive-foreground"?: string
  "--radius"?: string
  "--font-sans"?: string
  "--font-serif"?: string
  "--font-mono"?: string
}

export type ThemeColors = ThemeColorVars & ThemeStyleVars

export interface ThemeConfig {
  name: string
  label: string
  light: ThemeColors
  dark: ThemeColors
}

export const THEME_CSS_VARIABLES: string[] = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--radius",
  "--font-sans",
  "--font-serif",
  "--font-mono",
]

export const DEFAULT_THEME_NAME = "default"

export const themes: ThemeConfig[] = [
  {
    name: "default",
    label: "Mist",
    light: {
      "--background": "oklch(1 0 0)",
      "--foreground": "oklch(0.148 0.004 228.8)",
      "--card": "oklch(1 0 0)",
      "--card-foreground": "oklch(0.148 0.004 228.8)",
      "--popover": "oklch(1 0 0)",
      "--popover-foreground": "oklch(0.148 0.004 228.8)",
      "--primary": "oklch(0.852 0.199 91.936)",
      "--primary-foreground": "oklch(0.421 0.095 57.708)",
      "--secondary": "oklch(0.967 0.001 286.375)",
      "--secondary-foreground": "oklch(0.21 0.006 285.885)",
      "--muted": "oklch(0.963 0.002 197.1)",
      "--muted-foreground": "oklch(0.56 0.021 213.5)",
      "--accent": "oklch(0.963 0.002 197.1)",
      "--accent-foreground": "oklch(0.218 0.008 223.9)",
      "--destructive": "oklch(0.577 0.245 27.325)",
      "--border": "oklch(0.925 0.005 214.3)",
      "--input": "oklch(0.925 0.005 214.3)",
      "--ring": "oklch(0.723 0.014 214.4)",
      "--chart-1": "oklch(0.879 0.169 91.605)",
      "--chart-2": "oklch(0.769 0.188 70.08)",
      "--chart-3": "oklch(0.666 0.179 58.318)",
      "--chart-4": "oklch(0.555 0.163 48.998)",
      "--chart-5": "oklch(0.473 0.137 46.201)",
      "--sidebar": "oklch(0.987 0.002 197.1)",
      "--sidebar-foreground": "oklch(0.148 0.004 228.8)",
      "--sidebar-primary": "oklch(0.681 0.162 75.834)",
      "--sidebar-primary-foreground": "oklch(0.987 0.026 102.212)",
      "--sidebar-accent": "oklch(0.963 0.002 197.1)",
      "--sidebar-accent-foreground": "oklch(0.218 0.008 223.9)",
      "--sidebar-border": "oklch(0.925 0.005 214.3)",
      "--sidebar-ring": "oklch(0.723 0.014 214.4)",
    },
    dark: {
      "--background": "oklch(0.148 0.004 228.8)",
      "--foreground": "oklch(0.987 0.002 197.1)",
      "--card": "oklch(0.218 0.008 223.9)",
      "--card-foreground": "oklch(0.987 0.002 197.1)",
      "--popover": "oklch(0.218 0.008 223.9)",
      "--popover-foreground": "oklch(0.987 0.002 197.1)",
      "--primary": "oklch(0.795 0.184 86.047)",
      "--primary-foreground": "oklch(0.421 0.095 57.708)",
      "--secondary": "oklch(0.274 0.006 286.033)",
      "--secondary-foreground": "oklch(0.985 0 0)",
      "--muted": "oklch(0.275 0.011 216.9)",
      "--muted-foreground": "oklch(0.723 0.014 214.4)",
      "--accent": "oklch(0.275 0.011 216.9)",
      "--accent-foreground": "oklch(0.987 0.002 197.1)",
      "--destructive": "oklch(0.704 0.191 22.216)",
      "--border": "oklch(1 0 0 / 10%)",
      "--input": "oklch(1 0 0 / 15%)",
      "--ring": "oklch(0.56 0.021 213.5)",
      "--chart-1": "oklch(0.879 0.169 91.605)",
      "--chart-2": "oklch(0.769 0.188 70.08)",
      "--chart-3": "oklch(0.666 0.179 58.318)",
      "--chart-4": "oklch(0.555 0.163 48.998)",
      "--chart-5": "oklch(0.473 0.137 46.201)",
      "--sidebar": "oklch(0.218 0.008 223.9)",
      "--sidebar-foreground": "oklch(0.987 0.002 197.1)",
      "--sidebar-primary": "oklch(0.795 0.184 86.047)",
      "--sidebar-primary-foreground": "oklch(0.987 0.026 102.212)",
      "--sidebar-accent": "oklch(0.275 0.011 216.9)",
      "--sidebar-accent-foreground": "oklch(0.987 0.002 197.1)",
      "--sidebar-border": "oklch(1 0 0 / 10%)",
      "--sidebar-ring": "oklch(0.56 0.021 213.5)",
    },
  },
  {
    name: "claude",
    label: "Claude",
    light: {
      "--background": "oklch(0.9818 0.0054 95.0986)",
      "--foreground": "oklch(0.3438 0.0269 95.7226)",
      "--card": "oklch(0.9665 0.0067 97.3521)",
      "--card-foreground": "oklch(0.1908 0.0020 106.5859)",
      "--popover": "oklch(1.0000 0 0)",
      "--popover-foreground": "oklch(0.2671 0.0196 98.9390)",
      "--primary": "oklch(0.6171 0.1375 39.0427)",
      "--primary-foreground": "oklch(1.0000 0 0)",
      "--secondary": "oklch(0.9245 0.0138 92.9892)",
      "--secondary-foreground": "oklch(0.4334 0.0177 98.6048)",
      "--muted": "oklch(0.9341 0.0153 90.2390)",
      "--muted-foreground": "oklch(0.5341 0.0078 97.4503)",
      "--accent": "oklch(0.9245 0.0138 92.9892)",
      "--accent-foreground": "oklch(0.2671 0.0196 98.9390)",
      "--destructive": "oklch(0.1908 0.0020 106.5859)",
      "--destructive-foreground": "oklch(1.0000 0 0)",
      "--border": "oklch(0.8847 0.0069 97.3627)",
      "--input": "oklch(0.7621 0.0156 98.3528)",
      "--ring": "oklch(0.6171 0.1375 39.0427)",
      "--chart-1": "oklch(0.5583 0.1276 42.9956)",
      "--chart-2": "oklch(0.6898 0.1581 290.4107)",
      "--chart-3": "oklch(0.8816 0.0276 93.1280)",
      "--chart-4": "oklch(0.8822 0.0403 298.1792)",
      "--chart-5": "oklch(0.5608 0.1348 42.0584)",
      "--radius": "1rem",
      "--font-sans": "Outfit, sans-serif",
      "--font-mono": "Geist Mono, ui-monospace, monospace",
      "--sidebar": "oklch(0.9663 0.0080 98.8792)",
      "--sidebar-foreground": "oklch(0.3590 0.0051 106.6524)",
      "--sidebar-primary": "oklch(0.6171 0.1375 39.0427)",
      "--sidebar-primary-foreground": "oklch(0.9881 0 0)",
      "--sidebar-accent": "oklch(0.9245 0.0138 92.9892)",
      "--sidebar-accent-foreground": "oklch(0.3250 0 0)",
      "--sidebar-border": "oklch(0.9401 0 0)",
      "--sidebar-ring": "oklch(0.7731 0 0)",
    },
    dark: {
      "--background": "oklch(0.2679 0.0036 106.6427)",
      "--foreground": "oklch(0.9576 0.0027 106.4494)",
      "--card": "oklch(0.2928 0.0018 106.5092)",
      "--card-foreground": "oklch(0.9818 0.0054 95.0986)",
      "--popover": "oklch(0.3085 0.0035 106.6039)",
      "--popover-foreground": "oklch(0.9211 0.0040 106.4781)",
      "--primary": "oklch(0.6724 0.1308 38.7559)",
      "--primary-foreground": "oklch(0.1908 0.0020 106.5859)",
      "--secondary": "oklch(0.9818 0.0054 95.0986)",
      "--secondary-foreground": "oklch(0.3085 0.0035 106.6039)",
      "--muted": "oklch(0.2213 0.0038 106.7070)",
      "--muted-foreground": "oklch(0.7713 0.0169 99.0657)",
      "--accent": "oklch(0.2130 0.0078 95.4245)",
      "--accent-foreground": "oklch(0.9663 0.0080 98.8792)",
      "--destructive": "oklch(0.6368 0.2078 25.3313)",
      "--destructive-foreground": "oklch(1.0000 0 0)",
      "--border": "oklch(0.3618 0.0101 106.8928)",
      "--input": "oklch(0.4336 0.0113 100.2195)",
      "--ring": "oklch(0.6724 0.1308 38.7559)",
      "--chart-1": "oklch(0.5583 0.1276 42.9956)",
      "--chart-2": "oklch(0.6898 0.1581 290.4107)",
      "--chart-3": "oklch(0.2130 0.0078 95.4245)",
      "--chart-4": "oklch(0.3074 0.0516 289.3230)",
      "--chart-5": "oklch(0.5608 0.1348 42.0584)",
      "--radius": "1rem",
      "--font-sans": "Outfit, sans-serif",
      "--font-mono": "Geist Mono, ui-monospace, monospace",
      "--sidebar": "oklch(0.2357 0.0024 67.7077)",
      "--sidebar-foreground": "oklch(0.8074 0.0142 93.0137)",
      "--sidebar-primary": "oklch(0.3250 0 0)",
      "--sidebar-primary-foreground": "oklch(0.9881 0 0)",
      "--sidebar-accent": "oklch(0.1680 0.0020 106.6177)",
      "--sidebar-accent-foreground": "oklch(0.8074 0.0142 93.0137)",
      "--sidebar-border": "oklch(0.9401 0 0)",
      "--sidebar-ring": "oklch(0.7731 0 0)",
    },
  },
  {
    name: "2077",
    label: "2077",
    light: {
      "--background": "oklch(1.0000 0 0)",
      "--foreground": "oklch(0.2178 0 0)",
      "--card": "oklch(1.0000 0 0)",
      "--card-foreground": "oklch(0.2178 0 0)",
      "--popover": "oklch(1.0000 0 0)",
      "--popover-foreground": "oklch(0.2178 0 0)",
      "--primary": "oklch(0.2264 0 0)",
      "--primary-foreground": "oklch(1.0000 0 0)",
      "--secondary": "oklch(1.0000 0 0)",
      "--secondary-foreground": "oklch(0.2264 0 0)",
      "--muted": "oklch(1.0000 0 0)",
      "--muted-foreground": "oklch(0.6334 0 0)",
      "--accent": "oklch(1.0000 0 0)",
      "--accent-foreground": "oklch(0.2264 0 0)",
      "--destructive": "oklch(0.5954 0.2344 23.9586)",
      "--destructive-foreground": "oklch(1.0000 0 0)",
      "--border": "oklch(1.0000 0 0)",
      "--input": "oklch(1.0000 0 0)",
      "--ring": "oklch(0.8109 0 0)",
      "--chart-1": "oklch(0.9667 0.0148 251.1556)",
      "--chart-2": "oklch(0.7422 0.1166 260.2000)",
      "--chart-3": "oklch(0.6588 0.1585 264.3926)",
      "--chart-4": "oklch(0.5814 0.1857 265.2966)",
      "--chart-5": "oklch(0.4861 0.2073 266.0672)",
      "--radius": "0rem",
      "--font-sans": "Chakra Petch, ui-sans-serif, sans-serif, system-ui",
      "--font-mono": "IBM Plex Mono, ui-monospace, monospace",
      "--sidebar": "oklch(1.0000 0 0)",
      "--sidebar-foreground": "oklch(0.2178 0 0)",
      "--sidebar-primary": "oklch(0.2264 0 0)",
      "--sidebar-primary-foreground": "oklch(1.0000 0 0)",
      "--sidebar-accent": "oklch(1.0000 0 0)",
      "--sidebar-accent-foreground": "oklch(0.2264 0 0)",
      "--sidebar-border": "oklch(1.0000 0 0)",
      "--sidebar-ring": "oklch(0.8109 0 0)",
    },
    dark: {
      "--background": "oklch(0 0 0)",
      "--foreground": "oklch(1.0000 0 0)",
      "--card": "oklch(0 0 0)",
      "--card-foreground": "oklch(1.0000 0 0)",
      "--popover": "oklch(0 0 0)",
      "--popover-foreground": "oklch(1.0000 0 0)",
      "--primary": "oklch(0.6152 0.1657 26.9800)",
      "--primary-foreground": "oklch(0 0 0)",
      "--secondary": "oklch(0.6152 0.1657 26.9800)",
      "--secondary-foreground": "oklch(0 0 0)",
      "--muted": "oklch(0.2246 0.0094 107.1335)",
      "--muted-foreground": "oklch(1.0000 0 0)",
      "--accent": "oklch(0.6152 0.1657 26.9800)",
      "--accent-foreground": "oklch(0 0 0)",
      "--destructive": "oklch(0.6152 0.1657 26.9800)",
      "--destructive-foreground": "oklch(0 0 0)",
      "--border": "oklch(0.2520 0 0)",
      "--input": "oklch(0 0 0)",
      "--ring": "oklch(0.6152 0.1657 26.9800)",
      "--chart-1": "oklch(0.7152 0.1485 58.8324)",
      "--chart-2": "oklch(0.8299 0.1718 107.4066)",
      "--chart-3": "oklch(0.5798 0.1829 259.5141)",
      "--chart-4": "oklch(0.4962 0.2332 288.0574)",
      "--chart-5": "oklch(0.6152 0.1657 26.9800)",
      "--radius": "0rem",
      "--font-sans": "Chakra Petch, ui-sans-serif, sans-serif, system-ui",
      "--font-mono": "IBM Plex Mono, ui-monospace, monospace",
      "--sidebar": "oklch(0 0 0)",
      "--sidebar-foreground": "oklch(1.0000 0 0)",
      "--sidebar-primary": "oklch(0.6152 0.1657 26.9800)",
      "--sidebar-primary-foreground": "oklch(1.0000 0 0)",
      "--sidebar-accent": "oklch(0.6152 0.1657 26.9800)",
      "--sidebar-accent-foreground": "oklch(0 0 0)",
      "--sidebar-border": "oklch(0 0 0)",
      "--sidebar-ring": "oklch(0.6152 0.1657 26.9800)",
    },
  },
]

export function getThemeByName(name: string): ThemeConfig | undefined {
  return themes.find((t) => t.name === name)
}

export const themeNames = themes.map((t) => t.name)
