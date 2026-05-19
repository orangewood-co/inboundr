import { ChevronUpIcon, ChevronDownIcon } from "lucide-react"

export function NavigationControls({
  onPrev,
  onNext,
  canGoPrev,
  canGoNext,
  accent,
}: {
  onPrev: () => void
  onNext: () => void
  canGoPrev: boolean
  canGoNext: boolean
  accent: string
}) {
  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col gap-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        className="flex size-10 items-center justify-center rounded-lg bg-white text-stone-700 shadow-lg ring-1 ring-stone-200/60 transition-all hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous question"
      >
        <ChevronUpIcon className="size-5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="flex size-10 items-center justify-center rounded-lg text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ backgroundColor: accent }}
        aria-label="Next question"
      >
        <ChevronDownIcon className="size-5" />
      </button>
    </div>
  )
}
