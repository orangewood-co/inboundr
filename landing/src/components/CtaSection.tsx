import { Link } from "react-router-dom"
import { motion } from "motion/react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { FadeIn } from "@/components/FadeIn"

const MotionLink = motion.create(Link)

interface CtaAction {
  label: string
  href: string
  variant?: "primary" | "secondary"
  external?: boolean
  icon?: "arrow-right" | "arrow-up-right"
}

interface CtaSectionProps {
  heading: string
  description?: string
  actions: CtaAction[]
  border?: boolean
}

export function CtaSection({ heading, description, actions, border = true }: CtaSectionProps) {
  return (
    <section className={`px-6 py-24 sm:py-36 lg:px-8 ${border ? "border-t border-border" : ""}`}>
      <FadeIn className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-[-0.02em] sm:text-4xl lg:text-5xl">
          {heading}
        </h2>
        {description && (
          <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-text-muted">
            {description}
          </p>
        )}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {actions.map((action) => {
            const Icon = action.icon === "arrow-up-right" ? ArrowUpRight : ArrowRight
            const showIcon = !!action.icon
            const isSecondary = action.variant === "secondary"

            const className = isSecondary
              ? "inline-block border border-border px-7 py-3.5 text-sm font-medium transition-[border-color,background-color] duration-200 hover:border-text/20 hover:bg-surface"
              : "inline-block bg-text px-7 py-3.5 text-sm font-semibold text-base transition-shadow duration-200 hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"

            const motionProps = {
              whileHover: { scale: 1.02 },
              whileTap: { scale: 0.97 },
            }

            const inner = (
              <>
                {action.label}
                {showIcon && <Icon className="mb-px ml-1.5 inline size-3.5" />}
              </>
            )

            return action.external ? (
              <motion.a key={action.label} href={action.href} className={className} {...motionProps}>
                {inner}
              </motion.a>
            ) : (
              <MotionLink key={action.label} to={action.href} className={className} {...motionProps}>
                {inner}
              </MotionLink>
            )
          })}
        </div>
      </FadeIn>
    </section>
  )
}
