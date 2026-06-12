const LOCALE = "en-IN"

const moneyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat(LOCALE)

const compactNumberFormatter = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" })

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
})

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: "numeric",
  minute: "2-digit",
})

const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  day: "numeric",
})

const fullDateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const relativeTimeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" })

function toDate(value?: string | number | Date | null): Date | null {
  if (value == null || value === "") return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "₹1,23,456.78" — INR currency with Indian digit grouping. */
export function formatMoney(value: number): string {
  return moneyFormatter.format(value || 0)
}

/** "1,23,456" — plain number with Indian digit grouping. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value || 0)
}

/** "1.2L" / "3.4K" — compact notation for stats. */
export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value || 0)
}

/** "12 Jun 2026" — medium date, "-" when missing/invalid. */
export function formatDate(value?: string | Date | null): string {
  const date = toDate(value)
  return date ? dateFormatter.format(date) : "-"
}

/** "12 Jun 2026, 9:30 pm" — medium date + short time, "-" when missing/invalid. */
export function formatDateTime(value?: string | Date | null): string {
  const date = toDate(value)
  return date ? dateTimeFormatter.format(date) : "-"
}

/** "9:30 pm" — time only, "-" when missing/invalid. */
export function formatTime(value?: string | Date | null): string {
  const date = toDate(value)
  return date ? timeFormatter.format(date) : "-"
}

/** "12 Jun" — short month + day, "-" when missing/invalid. */
export function formatShortDate(value?: string | Date | null): string {
  const date = toDate(value)
  return date ? shortDateFormatter.format(date) : "-"
}

/** "Fri, 12 Jun 2026, 09:30 pm" — verbose timestamp for detail views. */
export function formatFullDateTime(value?: string | Date | null): string {
  const date = toDate(value)
  return date ? fullDateTimeFormatter.format(date) : "-"
}

const RELATIVE_DIVISIONS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.345, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
] as const

/** "3 hours ago" / "in 2 days" — relative to now, "-" when missing/invalid. */
export function formatRelativeTime(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return "-"

  let duration = Math.round((date.getTime() - Date.now()) / 1000)
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relativeTimeFormatter.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return "-"
}

/** List-row timestamp: time when today, "Yesterday", else "12 Jun". */
export function formatListTimestamp(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return "-"

  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return timeFormatter.format(date)
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

  return shortDateFormatter.format(date)
}
