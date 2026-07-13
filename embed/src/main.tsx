import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import AttendancePage from "./pages/attendance-page"
import DriveSharePage from "./pages/drive-share-page"
import FormPage from "./pages/form-page"
import LinkPage from "./pages/link-page"
import NotFound from "./pages/not-found"
import SupportPage from "./pages/support-page"
import CareersPage from "./pages/careers-page"

const path = window.location.pathname.replace(/\/+$/, "")
const params = new URLSearchParams(window.location.search)

const formMatch = path.match(/^\/form\/(.+)$/)
const linkMatch = path.match(/^\/l\/(.+)$/)
const attendanceMatch = path.match(/^\/attendance\/(.+)$/)
const driveMatch = path.match(/^\/d\/(.+)$/)
const supportMatch = path.match(/^\/support\/(.+)$/)
const careersMatch = path.match(/^\/careers\/([^/]+)(?:\/(?:jobs\/)?([^/]+))?$/)

let page: React.ReactNode
if (careersMatch) {
  page = (
    <CareersPage
      organizationPath={decodeURIComponent(careersMatch[1])}
      jobSlug={careersMatch[2] ? decodeURIComponent(careersMatch[2]) : undefined}
      embed={params.get("embed") === "1"}
    />
  )
} else if (attendanceMatch) {
  page = <AttendancePage organizationId={attendanceMatch[1]} />
} else if (supportMatch) {
  page = <SupportPage organizationId={supportMatch[1]} />
} else if (formMatch) {
  const slug = formMatch[1]
  const embed = params.get("embed") === "1"
  page = <FormPage slug={slug} embed={embed} />
} else if (linkMatch) {
  page = <LinkPage code={linkMatch[1]} />
} else if (driveMatch) {
  page = <DriveSharePage token={driveMatch[1]} />
} else {
  page = <NotFound />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{page}</StrictMode>,
)
