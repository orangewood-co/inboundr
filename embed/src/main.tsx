import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import FormPage from "./pages/form-page"
import LinkPage from "./pages/link-page"
import NotFound from "./pages/not-found"

const path = window.location.pathname.replace(/\/+$/, "")
const params = new URLSearchParams(window.location.search)

const formMatch = path.match(/^\/form\/(.+)$/)
const linkMatch = path.match(/^\/l\/(.+)$/)

let page: React.ReactNode
if (formMatch) {
  const slug = formMatch[1]
  const embed = params.get("embed") === "1"
  page = <FormPage slug={slug} embed={embed} />
} else if (linkMatch) {
  page = <LinkPage code={linkMatch[1]} />
} else {
  page = <NotFound />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{page}</StrictMode>,
)
