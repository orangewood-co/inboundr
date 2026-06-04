import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function toDate(value: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toValue(date: Date | undefined): string {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface DatePickerProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function DatePicker({ label, value, onChange, placeholder = "Pick a date" }: DatePickerProps) {
  const selected = toDate(value)
  const currentYear = new Date().getFullYear()
  const startMonth = new Date(currentYear - 10, 0)
  const endMonth = new Date(currentYear + 10, 11)

  return (
    <div className="grid gap-2">
      {label ? <Label className="text-xs">{label}</Label> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            data-empty={!selected}
            className="w-full justify-start font-normal data-[empty=true]:text-muted-foreground"
          >
            <CalendarIcon className="size-3.5" />
            {selected ? format(selected, "dd MMM yyyy") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onChange(toValue(date))}
            captionLayout="dropdown"
            defaultMonth={selected}
            startMonth={startMonth}
            endMonth={endMonth}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
