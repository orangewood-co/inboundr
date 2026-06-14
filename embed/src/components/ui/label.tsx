import type { LabelHTMLAttributes } from "react"

export function Label({
  className = "",
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`text-[13px] font-medium text-stone-600 dark:text-stone-300 ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
