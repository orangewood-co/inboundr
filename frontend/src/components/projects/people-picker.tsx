import { Checkbox } from "@/components/ui/checkbox"
import { toggleValue } from "@/components/projects/board-ui"
import type { ProjectEmployee } from "@/lib/projects"

export function MultiEmployeePicker({
  employees,
  value,
  onChange,
}: {
  employees: ProjectEmployee[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <div className="grid max-h-52 gap-2 overflow-auto rounded-xl border bg-muted/20 p-2 sm:grid-cols-2">
      {employees.map((employee) => (
        <label key={employee._id} className="flex items-center gap-2 rounded-lg bg-background/80 p-2 text-sm">
          <Checkbox
            checked={value.includes(employee._id)}
            onCheckedChange={(checked) => onChange(toggleValue(value, employee._id, checked === true))}
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{employee.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">{employee.email}</span>
          </span>
        </label>
      ))}
      {employees.length === 0 && <p className="text-sm text-muted-foreground">No active employees found.</p>}
    </div>
  )
}
