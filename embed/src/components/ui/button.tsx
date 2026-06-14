import type { ButtonHTMLAttributes } from "react"

export function Button({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:pointer-events-none disabled:bg-stone-200 disabled:text-stone-400 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white dark:focus-visible:ring-stone-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-600 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
