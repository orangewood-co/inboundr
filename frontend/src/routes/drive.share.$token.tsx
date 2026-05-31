import { createFileRoute } from "@tanstack/react-router"

import DriveSharePage from "@/pages/drive-share-page"

export const Route = createFileRoute("/drive/share/$token")({
  component: DriveSharePage,
})
