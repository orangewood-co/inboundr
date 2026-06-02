import { CalendarClockIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import type { ProjectEmployee } from "@/lib/projects"
import { cn, getAvatarColor } from "@/lib/utils"

export const STAGE_COLOR_PALETTE = [
  "#64748b",
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#16a34a",
  "#84cc16",
  "#eab308",
  "#d97706",
  "#ef4444",
  "#ec4899",
  "#a855f7",
  "#6366f1",
] as const

export function stageColor(color?: string | null): string {
  return color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : "#64748b"
}

export function dateInputValue(value?: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

export function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatDate(value?: string | null): string {
  const input = dateInputValue(value)
  if (!input) return "No date"
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(input))
}

export function formatDateShort(value?: string | null): string {
  const input = dateInputValue(value)
  if (!input) return ""
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(input))
}

export function formatMinutes(minutes?: number | null): string {
  if (!minutes) return "0h"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (!hours) return `${mins}m`
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "IN"
  )
}

export function toggleValue(values: string[], value: string, checked: boolean): string[] {
  if (checked) return [...new Set([...values, value])]
  return values.filter((item) => item !== value)
}

export function employeeName(employees: ProjectEmployee[], id: string): string {
  return employees.find((employee) => employee._id === id)?.fullName ?? "Unassigned"
}

export type DueProximity = "overdue" | "soon" | "none"

export function dueProximity(value?: string | null): DueProximity {
  const input = dateInputValue(value)
  if (!input) return "none"
  const due = new Date(`${input}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return "overdue"
  if (diffDays <= 2) return "soon"
  return "none"
}

export function EmployeeAvatar({
  employee,
  size = "sm",
}: {
  employee: ProjectEmployee
  size?: "sm" | "default"
}) {
  const palette = getAvatarColor(employee.fullName)
  return (
    <Avatar size={size} title={employee.fullName}>
      <AvatarFallback className={cn("text-[11px] font-semibold", palette.bg, palette.text)}>
        {initials(employee.fullName)}
      </AvatarFallback>
    </Avatar>
  )
}

export function EmployeeStack({
  employees,
  ids,
  limit = 4,
  size = "sm",
  emptyLabel = "Unassigned",
}: {
  employees: ProjectEmployee[]
  ids: string[]
  limit?: number
  size?: "sm" | "default"
  emptyLabel?: string | null
}) {
  const selected = ids
    .map((id) => employees.find((employee) => employee._id === id))
    .filter((employee): employee is ProjectEmployee => Boolean(employee))

  if (selected.length === 0) {
    return emptyLabel ? <span className="text-xs text-muted-foreground">{emptyLabel}</span> : null
  }

  const shown = selected.slice(0, limit)
  const extra = selected.length - shown.length

  return (
    <AvatarGroup>
      {shown.map((employee) => (
        <EmployeeAvatar key={employee._id} employee={employee} size={size} />
      ))}
      {extra > 0 && (
        <AvatarGroupCount className={size === "sm" ? "size-6 text-[11px]" : undefined}>
          +{extra}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  )
}

export function DueDatePill({
  due,
  className,
}: {
  due?: string | null
  className?: string
}) {
  const label = formatDateShort(due)
  if (!label) return null
  const proximity = dueProximity(due)
  const tone =
    proximity === "overdue"
      ? "bg-destructive/15 text-destructive"
      : proximity === "soon"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone,
        className
      )}
    >
      <CalendarClockIcon className="size-3" />
      {label}
    </span>
  )
}
