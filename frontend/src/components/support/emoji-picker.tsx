import { useState } from "react"
import { EmojiPicker as Frimousse } from "frimousse"
import { SmileIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function EmojiPicker({
  onSelect,
  disabled,
}: {
  onSelect: (emoji: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label="Insert emoji">
              <SmileIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Emoji</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" side="top" className="w-auto p-0">
        <Frimousse.Root
          onEmojiSelect={({ emoji }) => {
            onSelect(emoji)
            setOpen(false)
          }}
          className="isolate flex h-[320px] w-[300px] flex-col bg-popover"
        >
          <Frimousse.Search
            placeholder="Search emoji..."
            className="z-10 mx-2 mt-2 appearance-none rounded-md border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Frimousse.Viewport className="relative flex-1 outline-none">
            <Frimousse.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Loading...
            </Frimousse.Loading>
            <Frimousse.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No emoji found.
            </Frimousse.Empty>
            <Frimousse.List
              className="pb-1.5 select-none"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div
                    className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-muted"
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </Frimousse.Viewport>
        </Frimousse.Root>
      </PopoverContent>
    </Popover>
  )
}
