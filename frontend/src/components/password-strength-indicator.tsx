import { useMemo } from "react"

import { cn } from "@/lib/utils"

const STRENGTH_CONFIG = [
  { label: "Too short", color: "bg-destructive" },
  { label: "Weak", color: "bg-destructive" },
  { label: "Fair", color: "bg-warning" },
  { label: "Good", color: "bg-success/70" },
  { label: "Strong", color: "bg-success" },
] as const

function getPasswordStrength(password: string): number {
  if (password.length === 0) return -1
  if (password.length < 8) return 0

  let score = 0
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (password.length >= 12) score++

  return Math.min(score, 4)
}

export function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = useMemo(() => getPasswordStrength(password), [password])
  if (strength < 0) return null

  const config = STRENGTH_CONFIG[strength]

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= strength ? config.color : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", strength <= 1 ? "text-destructive" : "text-muted-foreground")}>
        {config.label}
      </p>
    </div>
  )
}
