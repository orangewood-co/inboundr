import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const AVATAR_PALETTES = [
  { bg: "bg-blue-500/15 dark:bg-blue-500/25", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-emerald-500/15 dark:bg-emerald-500/25", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-violet-500/15 dark:bg-violet-500/25", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-amber-500/15 dark:bg-amber-500/25", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-rose-500/15 dark:bg-rose-500/25", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-cyan-500/15 dark:bg-cyan-500/25", text: "text-cyan-700 dark:text-cyan-300" },
  { bg: "bg-orange-500/15 dark:bg-orange-500/25", text: "text-orange-700 dark:text-orange-300" },
  { bg: "bg-pink-500/15 dark:bg-pink-500/25", text: "text-pink-700 dark:text-pink-300" },
  { bg: "bg-teal-500/15 dark:bg-teal-500/25", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-indigo-500/15 dark:bg-indigo-500/25", text: "text-indigo-700 dark:text-indigo-300" },
]

export function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length]
}

export function copyToClipboard(value: string, label = "Copied to clipboard") {
  navigator.clipboard.writeText(value).then(
    () => toast.success(label),
    () => toast.error("Failed to copy")
  )
}
