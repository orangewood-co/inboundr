import type { Ref, TextareaHTMLAttributes } from "react"

export function Textarea({
  className = "",
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      ref={ref}
      className={`flex w-full resize-none rounded-xl border border-stone-300/80 bg-white px-3.5 py-2.5 text-base text-stone-900 placeholder:text-stone-400 outline-none transition focus-visible:border-stone-400 focus-visible:ring-4 focus-visible:ring-stone-900/5 disabled:opacity-50 sm:text-sm dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus-visible:border-stone-500 dark:focus-visible:ring-white/5 ${className}`}
      {...props}
    />
  )
}
