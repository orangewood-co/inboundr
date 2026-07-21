import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { setWorkflowEnabled, updateWorkflow } from "@/lib/workflows"

import { useWorkflowBuilderStore } from "./store"

export function WorkflowHeaderActions() {
  const workflowId = useWorkflowBuilderStore((state) => state.workflowId)
  const name = useWorkflowBuilderStore((state) => state.name)
  const enabled = useWorkflowBuilderStore((state) => state.enabled)
  const dirty = useWorkflowBuilderStore((state) => state.dirty)
  const setEnabled = useWorkflowBuilderStore((state) => state.setEnabled)
  const markSaved = useWorkflowBuilderStore((state) => state.markSaved)
  const serializeGraph = useWorkflowBuilderStore((state) => state.serializeGraph)

  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  if (!workflowId) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const graph = serializeGraph()
      await updateWorkflow(workflowId, { name, ...graph })
      markSaved()
      toast.success("Workflow saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save workflow")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (next: boolean) => {
    if (next && dirty) {
      toast.error("Save the workflow before enabling it")
      return
    }
    setToggling(true)
    try {
      const workflow = await setWorkflowEnabled(workflowId, next)
      setEnabled(workflow.enabled)
      toast.success(workflow.enabled ? "Workflow enabled" : "Workflow disabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update workflow")
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 pr-1 text-xs font-medium">
        <Switch checked={enabled} onCheckedChange={handleToggleEnabled} disabled={toggling} />
        {enabled ? "Enabled" : "Disabled"}
      </label>
      <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
        {saving && <Spinner data-icon="inline-start" />}
        {dirty ? "Save" : "Saved"}
      </Button>
    </>
  )
}
