import { useRef, useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  CopyIcon,
  GripVerticalIcon,
  PlusIcon,
  Settings2Icon,
  StarIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { BlockInsertMenu } from "@/components/forms/block-insert-menu"
import { FieldSettingsPopover } from "@/components/forms/field-settings-popover"
import {
  FIELD_TYPE_META,
  type FieldType,
  type FormField,
} from "@/components/forms/types"

const PLACEHOLDER_HINTS: Partial<Record<FieldType, string>> = {
  short_text: "Add placeholder text (optional)",
  long_text: "Add placeholder text (optional)",
  email: "name@example.com",
  phone: "+91 98765 43210",
  number: "0",
  url: "https://",
}

export function FieldBlock({
  field,
  onChange,
  onDuplicate,
  onRemove,
  onInsertBelow,
  onEnterInLabel,
  onBackspaceEmptyLabel,
  registerLabelRef,
}: {
  field: FormField
  onChange: (patch: Partial<FormField>) => void
  onDuplicate: () => void
  onRemove: () => void
  onInsertBelow: (type: FieldType) => void
  onEnterInLabel: () => void
  onBackspaceEmptyLabel: () => void
  registerLabelRef: (el: HTMLInputElement | null) => void
}) {
  const [insertOpen, setInsertOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const meta = FIELD_TYPE_META[field.type]
  const TypeIcon = meta.icon

  function handleLabelKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      onEnterInLabel()
    } else if (event.key === "Backspace" && field.label === "") {
      event.preventDefault()
      onBackspaceEmptyLabel()
    }
  }

  function handleBlockKeyDown(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
      event.preventDefault()
      event.stopPropagation()
      onDuplicate()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onKeyDown={handleBlockKeyDown}
      className={cn(
        "group relative -mx-3 rounded-lg px-3 py-3 transition-colors",
        "hover:bg-muted/40 focus-within:bg-muted/30",
        isDragging && "z-20 bg-background opacity-80 shadow-lg ring-1 ring-border",
        insertOpen && "bg-muted/40",
      )}
    >
      {/* Left gutter controls */}
      <div
        className={cn(
          "absolute -left-8 top-3 flex flex-col items-center opacity-0 transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100",
          insertOpen && "opacity-100",
        )}
      >
        <BlockInsertMenu
          open={insertOpen}
          onOpenChange={setInsertOpen}
          onInsert={onInsertBelow}
          side="bottom"
          align="start"
        >
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
            title="Insert question below"
          >
            <PlusIcon className="size-4" />
          </button>
        </BlockInsertMenu>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex size-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVerticalIcon className="size-4" />
        </button>
      </div>

      {/* Floating block toolbar */}
      <div
        className={cn(
          "absolute -top-3.5 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-background p-0.5 opacity-0 shadow-sm transition-opacity",
          "group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100",
        )}
      >
        <FieldSettingsPopover field={field} onChange={onChange}>
          <button
            type="button"
            className="flex h-6 items-center gap-1.5 rounded px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <TypeIcon className="size-3.5" />
            {meta.label}
            <Settings2Icon className="size-3" />
          </button>
        </FieldSettingsPopover>
        <div className="h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onDuplicate}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CopyIcon className="size-3.5" />
              <span className="sr-only">Duplicate question</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Duplicate</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onRemove}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2Icon className="size-3.5" />
              <span className="sr-only">Delete question</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>

      {/* Question label */}
      <div className="flex items-baseline">
        <input
          ref={registerLabelRef}
          value={field.label}
          onChange={(event) => onChange({ label: event.target.value })}
          onKeyDown={handleLabelKeyDown}
          placeholder="Type your question"
          className="field-sizing-content max-w-full min-w-8 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/40"
        />
        {field.required && <span className="ml-0.5 select-none text-destructive">*</span>}
      </div>

      {/* Helper text */}
      <input
        value={field.description ?? ""}
        onChange={(event) => onChange({ description: event.target.value || null })}
        placeholder="Add a description (optional)"
        className={cn(
          "mt-0.5 w-full bg-transparent text-[13px] text-muted-foreground outline-none placeholder:text-muted-foreground/40",
          field.description
            ? "block"
            : "hidden group-focus-within:block group-hover:block",
        )}
      />

      {/* Answer preview */}
      <div className="mt-2.5">
        <AnswerPreview field={field} onChange={onChange} />
      </div>
    </div>
  )
}

function AnswerPreview({
  field,
  onChange,
}: {
  field: FormField
  onChange: (patch: Partial<FormField>) => void
}) {
  switch (field.type) {
    case "short_text":
    case "email":
    case "phone":
    case "number":
    case "url":
      return (
        <input
          value={field.placeholder ?? ""}
          onChange={(event) => onChange({ placeholder: event.target.value })}
          placeholder={PLACEHOLDER_HINTS[field.type]}
          className="h-9 w-full max-w-md rounded-md border border-input/70 bg-background/60 px-3 text-sm text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-ring"
          title="Shown as placeholder text to respondents"
        />
      )
    case "long_text":
      return (
        <textarea
          rows={2}
          value={field.placeholder ?? ""}
          onChange={(event) => onChange({ placeholder: event.target.value })}
          placeholder={PLACEHOLDER_HINTS.long_text}
          className="field-sizing-content min-h-16 w-full max-w-lg resize-none rounded-md border border-input/70 bg-background/60 px-3 py-2 text-sm text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-ring"
          title="Shown as placeholder text to respondents"
        />
      )
    case "date":
      return (
        <div className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md border border-input/70 bg-background/60 px-3 text-sm text-muted-foreground/50">
          <CalendarIcon className="size-4" />
          Select a date
        </div>
      )
    case "rating":
      return (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <StarIcon key={index} className="size-6 text-muted-foreground/30" />
          ))}
        </div>
      )
    case "yes_no":
      return (
        <div className="flex gap-2">
          {["Yes", "No"].map((option) => (
            <div
              key={option}
              className="flex h-9 items-center rounded-md border border-input/70 bg-background/60 px-5 text-sm text-muted-foreground/60"
            >
              {option}
            </div>
          ))}
        </div>
      )
    case "file": {
      const constraints = [
        `Up to ${field.maxFileSizeMb ?? 10} MB`,
        field.multiple ? "multiple files" : null,
        (field.allowedMimeTypes ?? []).length > 0 ? (field.allowedMimeTypes ?? []).join(", ") : null,
      ]
        .filter(Boolean)
        .join(" · ")
      return (
        <div className="flex w-full max-w-md flex-col items-center gap-1 rounded-lg border border-dashed border-input bg-background/60 px-4 py-6 text-center">
          <UploadCloudIcon className="size-5 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground/60">Click to upload or drag and drop</p>
          <p className="text-xs text-muted-foreground/40">{constraints}</p>
        </div>
      )
    }
    case "dropdown":
    case "checkbox":
      return <OptionsEditor field={field} onChange={onChange} />
  }
}

function OptionsEditor({
  field,
  onChange,
}: {
  field: FormField
  onChange: (patch: Partial<FormField>) => void
}) {
  const options = field.options ?? []
  const pendingFocusIndex = useRef<number | null>(null)

  function updateOption(index: number, value: string) {
    const next = [...options]
    next[index] = value
    onChange({ options: next })
  }

  function addOption(afterIndex: number) {
    const next = [...options]
    next.splice(afterIndex + 1, 0, "")
    onChange({ options: next })
    pendingFocusIndex.current = afterIndex + 1
  }

  function removeOption(index: number) {
    onChange({ options: options.filter((_, i) => i !== index) })
    if (index > 0) pendingFocusIndex.current = index - 1
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault()
      addOption(index)
    } else if (event.key === "Backspace" && options[index] === "" && options.length > 1) {
      event.preventDefault()
      removeOption(index)
    }
  }

  const Bullet = field.type === "checkbox" ? CheckboxBullet : DropdownBullet

  return (
    <div className="max-w-md space-y-0.5">
      {options.map((option, index) => (
        <div key={index} className="group/option flex items-center gap-2.5 rounded px-1 py-0.5">
          <Bullet />
          <input
            ref={(el) => {
              if (el && pendingFocusIndex.current === index) {
                pendingFocusIndex.current = null
                el.focus()
              }
            }}
            value={option}
            onChange={(event) => updateOption(index, event.target.value)}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
            placeholder={`Option ${index + 1}`}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={() => removeOption(index)}
            className="flex size-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover/option:opacity-100"
            title="Remove option"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addOption(options.length - 1)}
        className="flex items-center gap-2.5 rounded px-1 py-0.5 text-sm text-muted-foreground/50 transition-colors hover:text-foreground"
      >
        <span className="flex size-4 items-center justify-center">
          <PlusIcon className="size-3.5" />
        </span>
        Add option
      </button>
      {field.type === "dropdown" && (
        <p className="flex items-center gap-1 pl-1 pt-1 text-xs text-muted-foreground/40">
          <ChevronDownIcon className="size-3" />
          Shown as a dropdown to respondents
        </p>
      )}
    </div>
  )
}

function CheckboxBullet() {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-background/60">
      <CheckIcon className="size-3 text-transparent" />
    </span>
  )
}

function DropdownBullet() {
  return <CircleIcon className="size-4 shrink-0 text-muted-foreground/30" />
}
