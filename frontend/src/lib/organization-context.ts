export const ACTIVE_ORGANIZATION_ID_KEY = "btsa.activeOrganizationId"
export const ACTIVE_ORGANIZATION_CHANGED_EVENT = "btsa:active-organization-changed"

export function getActiveOrganizationId(): string | null {
  return window.localStorage.getItem(ACTIVE_ORGANIZATION_ID_KEY)
}

export function setActiveOrganizationId(organizationId: string): void {
  window.localStorage.setItem(ACTIVE_ORGANIZATION_ID_KEY, organizationId)
  window.dispatchEvent(new CustomEvent(ACTIVE_ORGANIZATION_CHANGED_EVENT, { detail: { organizationId } }))
}

export function installOrganizationFetchContext(apiOrigin: string): void {
  const originalFetch = window.fetch.bind(window)

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const activeOrganizationId = getActiveOrganizationId()

    if (!activeOrganizationId || !url.startsWith(apiOrigin)) {
      return originalFetch(input, init)
    }

    const headers = new Headers(init.headers)
    if (!headers.has("x-organization-id")) {
      headers.set("x-organization-id", activeOrganizationId)
    }

    return originalFetch(input, { ...init, headers })
  }
}
