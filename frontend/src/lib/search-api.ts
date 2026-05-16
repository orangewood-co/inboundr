const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const SEARCH_API = `${API_ORIGIN}/api/v1/search`

export type SearchResultType = "customer" | "product" | "rfq"

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  subtitle: string
  metadata: Record<string, string | number | boolean | null>
  url: string
}

export interface SearchResponse {
  query: string
  minQueryLength: number
  results: {
    customers: SearchResult[]
    products: SearchResult[]
    rfqs: SearchResult[]
  }
  total: number
}

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
