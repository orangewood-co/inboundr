import type { InputHTMLAttributes } from "react"

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`flex h-10 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus-visible:ring-2 focus-visible:ring-stone-300 disabled:opacity-50 ${className}`}
      {...props}
    />
  )
}
