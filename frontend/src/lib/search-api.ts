import {
  Building2Icon,
  BoxIcon,
  ClipboardIcon,
  FileIcon,
  FileTextIcon,
  FolderKanbanIcon,
  LifeBuoyIcon,
  LinkIcon,
  PackageIcon,
  ReceiptIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { API_ORIGIN } from "@/lib/env"

const SEARCH_API = `${API_ORIGIN}/api/v1/search`

export type SearchResultType =
  | "customer"
  | "product"
  | "rfq"
  | "asset"
  | "invoice"
  | "employee"
  | "project"
  | "ticket"
  | "form"
  | "link"
  | "driveFile"

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  subtitle: string
  metadata: Record<string, string | number | boolean | null>
  url: string
}

export type SearchGroupKey =
  | "customers"
  | "products"
  | "rfqs"
  | "assets"
  | "invoices"
  | "employees"
  | "projects"
  | "tickets"
  | "forms"
  | "links"
  | "driveFiles"

export interface SearchResponse {
  query: string
  minQueryLength: number
  results: Record<SearchGroupKey, SearchResult[]>
  total: number
}

export interface SearchGroup {
  key: SearchGroupKey
  label: string
  icon: LucideIcon
}

export const SEARCH_GROUPS: SearchGroup[] = [
  { key: "customers", label: "Customers", icon: Building2Icon },
  { key: "products", label: "Products", icon: PackageIcon },
  { key: "rfqs", label: "RFQs", icon: FileTextIcon },
  { key: "assets", label: "Assets", icon: BoxIcon },
  { key: "invoices", label: "Invoices", icon: ReceiptIcon },
  { key: "employees", label: "Employees", icon: UsersIcon },
  { key: "projects", label: "Projects", icon: FolderKanbanIcon },
  { key: "tickets", label: "Tickets", icon: LifeBuoyIcon },
  { key: "forms", label: "Forms", icon: ClipboardIcon },
  { key: "links", label: "Links", icon: LinkIcon },
  { key: "driveFiles", label: "Drive Files", icon: FileIcon },
]

export async function fetchGlobalSearch(query: string, limit = 5, signal?: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  })
  const response = await fetch(`${SEARCH_API}?${params.toString()}`, {
    credentials: "include",
    signal,
  })

  if (!response.ok) {
    throw new Error("Search request failed")
  }

  return response.json()
}
