import { type ReactNode } from "react"
import { FadeIn } from "@/components/FadeIn"

interface PageHeaderProps {
  label: string
  title: string
  description?: string
  children?: ReactNode
}

export function PageHeader({ label, title, description, children }: PageHeaderProps) {
  return (
    <section className="noise grid-lines relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_35%_at_50%_0%,rgba(47,93,80,0.2),transparent)]" />
      <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
        <FadeIn>
          <p className="label mb-4 text-green-bright">{label}</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="mt-6 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">{description}</p>
          )}
          {children}
        </FadeIn>
      </div>
    </section>
  )
}
