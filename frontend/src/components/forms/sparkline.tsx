import { useId } from "react"

import { cn } from "@/lib/utils"

/**
 * Dependency-free SVG area sparkline. Scales to its container via viewBox.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  className,
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
}) {
  const gradientId = useId()
  const max = Math.max(...data, 1)
  const pad = 2
  const innerHeight = height - pad * 2
  const step = data.length > 1 ? width / (data.length - 1) : width

  const points = data.map((value, index) => {
    const x = index * step
    const y = pad + innerHeight - (value / max) * innerHeight
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-primary", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
