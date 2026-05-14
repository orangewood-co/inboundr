import type { LabelHTMLAttributes } from "react"

export function Label({
  className = "",
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`text-sm font-medium text-stone-700 ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
