import { API_ORIGIN } from "@/lib/env"
import { getActiveOrganizationId } from "@/lib/organization-context"

const API_BASE = `${API_ORIGIN}/api/v1/dashboard-layout`

export interface HomeLayoutItem {
  id: string
  hidden: boolean
}

interface HomeLayoutResponse {
  items: HomeLayoutItem[]
}

function normalizeItems(raw: unknown): HomeLayoutItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((entry): entry is { id: unknown; hidden?: unknown } => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({ id: String(entry.id ?? ""), hidden: Boolean(entry.hidden) }))
    .filter((item) => item.id.length > 0)
}

export async function getHomeLayout(): Promise<HomeLayoutItem[]> {
  const response = await fetch(API_BASE, { credentials: "include" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as HomeLayoutResponse
  return normalizeItems(data.items)
}

export async function saveHomeLayout(items: HomeLayoutItem[]): Promise<HomeLayoutItem[]> {
  const response = await fetch(API_BASE, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = (await response.json()) as HomeLayoutResponse
  return normalizeItems(data.items)
}

// localStorage cache so the dashboard paints its saved arrangement instantly on
// load, before the backend round-trip reconciles it.
function cacheKey(userId: string): string | null {
  const orgId = getActiveOrganizationId()
  if (!userId || !orgId) return null
  return `btsa:home-layout:${userId}:${orgId}`
}

export function getCachedHomeLayout(userId: string): HomeLayoutItem[] | null {
  const key = cacheKey(userId)
  if (!key) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return normalizeItems(JSON.parse(raw))
  } catch {
    return null
  }
}

export function setCachedHomeLayout(userId: string, items: HomeLayoutItem[]): void {
  const key = cacheKey(userId)
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // ignore quota / serialization errors — cache is best-effort
  }
}
