import type { Ref, TextareaHTMLAttributes } from "react"

export function Textarea({
  className = "",
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      className={`flex w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-base text-stone-900 placeholder:text-stone-400 outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300 disabled:opacity-50 sm:text-sm ${className}`}
      {...props}
    />
  )
}
