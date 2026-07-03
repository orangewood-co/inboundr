import { useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CheckIcon, PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { BlockInsertMenu } from "@/components/forms/block-insert-menu"
import { FieldBlock } from "@/components/forms/field-block"
import type { FieldType, FormField } from "@/components/forms/types"

export function FormCanvas({
  title,
  description,
  successMessage,
  fields,
  onTitleChange,
  onDescriptionChange,
  onSuccessMessageChange,
  onUpdateField,
  onInsertField,
  onDuplicateField,
  onRemoveField,
  onMoveField,
}: {
  title: string
  description: string
  successMessage: string
  fields: FormField[]
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSuccessMessageChange: (value: string) => void
  onUpdateField: (id: string, patch: Partial<FormField>) => void
  onInsertField: (type: FieldType, index: number) => FormField
  onDuplicateField: (id: string) => FormField | null
  onRemoveField: (id: string) => void
  onMoveField: (activeId: string, overId: string) => void
}) {
  const [endInsertOpen, setEndInsertOpen] = useState(false)
  const pendingFocusId = useRef<string | null>(null)
  const labelRefs = useRef(new Map<string, HTMLInputElement>())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function insertAt(type: FieldType, index: number) {
    const field = onInsertField(type, index)
    pendingFocusId.current = field.id
  }

  function duplicate(id: string) {
    const field = onDuplicateField(id)
    if (field) pendingFocusId.current = field.id
  }

  function removeAndFocusPrevious(id: string) {
    const index = fields.findIndex((field) => field.id === id)
    const previous = index > 0 ? fields[index - 1] : null
    labelRefs.current.delete(id)
    onRemoveField(id)
    if (previous) pendingFocusId.current = previous.id
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onMoveField(String(active.id), String(over.id))
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-12 pb-24 pt-12 sm:px-14">
      {/* Welcome: title + description, edited inline */}
      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Form title"
        className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/30"
      />
      <textarea
        rows={1}
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Add a description to welcome respondents (optional)"
        className="field-sizing-content mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/40"
      />

      {/* Question blocks */}
      <div className="mt-8">
        {fields.length === 0 ? (
          <BlockInsertMenu
            open={endInsertOpen}
            onOpenChange={setEndInsertOpen}
            onInsert={(type) => insertAt(type, 0)}
          >
            <button
              type="button"
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors hover:border-muted-foreground/40 hover:bg-muted/30"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <PlusIcon className="size-4.5 text-primary" />
              </span>
              <span className="text-sm font-medium">Add Your First Question</span>
              <span className="text-[13px] text-muted-foreground">
                Choose from 12 question types — text, choices, ratings, files, and more.
              </span>
            </button>
          </BlockInsertMenu>
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {fields.map((field, index) => (
                    <FieldBlock
                      key={field.id}
                      field={field}
                      onChange={(patch) => onUpdateField(field.id, patch)}
                      onDuplicate={() => duplicate(field.id)}
                      onRemove={() => removeAndFocusPrevious(field.id)}
                      onInsertBelow={(type) => insertAt(type, index + 1)}
                      onEnterInLabel={() => insertAt("short_text", index + 1)}
                      onBackspaceEmptyLabel={() => removeAndFocusPrevious(field.id)}
                      registerLabelRef={(el) => {
                        if (el) {
                          labelRefs.current.set(field.id, el)
                          if (pendingFocusId.current === field.id) {
                            pendingFocusId.current = null
                            el.focus()
                          }
                        } else {
                          labelRefs.current.delete(field.id)
                        }
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <BlockInsertMenu
              open={endInsertOpen}
              onOpenChange={setEndInsertOpen}
              onInsert={(type) => insertAt(type, fields.length)}
            >
              <button
                type="button"
                className={cn(
                  "mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground/60 transition-colors",
                  "hover:bg-muted/50 hover:text-foreground",
                  endInsertOpen && "bg-muted/50 text-foreground",
                )}
              >
                <PlusIcon className="size-4" />
                Add Question
              </button>
            </BlockInsertMenu>
          </>
        )}
      </div>

      {/* Ending */}
      <div className="mt-14 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Ending
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="group mt-6 rounded-xl border bg-card px-8 py-10 text-center shadow-xs">
        <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-success/15">
          <CheckIcon className="size-5 text-success" />
        </div>
        <p className="font-semibold">Thanks for Your Response</p>
        <textarea
          rows={1}
          value={successMessage}
          onChange={(event) => onSuccessMessageChange(event.target.value)}
          placeholder="Thanks! Your response has been recorded."
          className="field-sizing-content mx-auto mt-1.5 block w-full max-w-sm resize-none bg-transparent text-center text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/40"
        />
        <p className="mt-4 text-xs text-muted-foreground/50 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          Shown to respondents after they submit.
        </p>
      </div>
    </div>
  )
}
