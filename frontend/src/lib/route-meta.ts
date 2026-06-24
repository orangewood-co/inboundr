export const APP_TITLE = "Inboundr"

/**
 * Single source of truth for route → display label.
 * Consumed by the breadcrumb in SiteHeader and document.title in the root route.
 */
export const ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/admin": "Super Admin",
  "/admin/feedback": "Feedback",
  "/chat": "AI Chat",
  "/customers": "Customers",
  "/customers/import": "Import Customers",
  "/drive": "Drive",
  "/emails": "Inbox",
  "/employees": "Employees",
  "/feedback": "Feedback",
  "/employees/attendance": "Attendance",
  "/employees/attendance/logs": "Attendance Logs",
  "/employees/new": "New Employee",
  "/forgot-password": "Forgot Password",
  "/forms": "Forms",
  "/invoices": "Invoices",
  "/invoices/new": "New Invoice",
  "/links": "Links",
  "/links/create": "Create Link",
  "/login": "Login",
  "/orders": "Orders",
  "/products": "Products",
  "/products/import": "Import Products",
  "/projects": "Projects",
  "/projects/new": "New Project",
  "/register": "Register",
  "/reset-password": "Reset Password",
  "/rfq": "RFQ",
  "/search": "Search",
  "/settings": "Settings",
  "/stats": "Stats",
}

const DYNAMIC_TITLES: Array<{ match: (pathname: string) => boolean; title: string }> = [
  { match: (p) => p.startsWith("/admin/organizations/"), title: "Organization Admin" },
  { match: (p) => p.startsWith("/admin/feedback/"), title: "Feedback Details" },
  { match: (p) => p.startsWith("/forms/"), title: "Form Editor" },
  { match: (p) => p.startsWith("/invoices/"), title: "Invoice Details" },
  { match: (p) => p.startsWith("/customers/"), title: "Customer Details" },
  { match: (p) => p.startsWith("/employees/"), title: "Employee Details" },
  { match: (p) => p.includes("/tasks/"), title: "Task Details" },
  { match: (p) => p.startsWith("/projects/"), title: "Project Details" },
  { match: (p) => p.startsWith("/links/"), title: "Link Details" },
  { match: (p) => p.startsWith("/invite/"), title: "Invitation" },
]

/** Browser tab title for a pathname, e.g. "Invoices - Inboundr". */
export function documentTitleForPath(pathname: string): string {
  const exact = ROUTE_LABELS[pathname]
  if (exact) return `${exact} - ${APP_TITLE}`

  const dynamic = DYNAMIC_TITLES.find((entry) => entry.match(pathname))
  if (dynamic) return `${dynamic.title} - ${APP_TITLE}`

  return APP_TITLE
}
