import React, { type ReactNode } from "react"

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode
  showRadialGradient?: boolean
}

export function AuroraBackground({
  className = "",
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className={[
            "[--aurora-base:#060906]",
            "[--transparent:transparent]",
            "[--aurora-1:#3ecf8e]",
            "[--aurora-2:#efc554]",
            "[--aurora-3:#5ddba5]",
            "[--aurora-4:#f0d97a]",
            "[--aurora-5:#2f5d50]",
            "[--base-gradient:repeating-linear-gradient(100deg,var(--aurora-base)_0%,var(--aurora-base)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--aurora-base)_16%)]",
            "[--aurora:repeating-linear-gradient(100deg,var(--aurora-1)_10%,var(--aurora-2)_15%,var(--aurora-3)_20%,var(--aurora-4)_25%,var(--aurora-5)_30%)]",
            "[background-image:var(--base-gradient),var(--aurora)]",
            "[background-size:300%,_200%]",
            "[background-position:50%_50%,50%_50%]",
            "filter blur-[10px]",
            'after:content-[""] after:absolute after:inset-0',
            "after:[background-image:var(--base-gradient),var(--aurora)]",
            "after:[background-size:200%,_100%]",
            "after:animate-aurora after:[background-attachment:fixed] after:mix-blend-difference",
            "pointer-events-none",
            "absolute -inset-[10px] opacity-50 will-change-transform",
            showRadialGradient
              ? "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]"
              : "",
          ].join(" ")}
        />
      </div>
      {children}
    </div>
  )
}
