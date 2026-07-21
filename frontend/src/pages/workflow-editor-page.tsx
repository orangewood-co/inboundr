import { useEffect, useState } from "react"
import { useParams } from "@tanstack/react-router"

import { AppLayout } from "@/components/app-layout"
import { ErrorState } from "@/components/list-states"
import { SiteHeader } from "@/components/site-header"
import { Spinner } from "@/components/ui/spinner"
import { WorkflowEditor } from "@/components/workflows/editor"
import { WorkflowHeaderActions } from "@/components/workflows/header-actions"
import { useWorkflowBuilderStore } from "@/components/workflows/store"
import { getWorkflow } from "@/lib/workflows"

export default function WorkflowEditorPage() {
  const { id } = useParams({ from: "/workflows_/$id" })
  const hydrate = useWorkflowBuilderStore((state) => state.hydrate)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getWorkflow(id)
      .then((workflow) => {
        if (cancelled) return
        hydrate(workflow)
        setLoading(false)
      })
      .catch((err: any) => {
        if (cancelled) return
        setError(err.message || "Failed to load workflow")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, hydrate])

  return (
    <AppLayout>
      <SiteHeader actions={<WorkflowHeaderActions />} />
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <WorkflowEditor />
      )}
    </AppLayout>
  )
}
