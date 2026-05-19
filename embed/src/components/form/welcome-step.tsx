import { motion } from "motion/react"
import { ArrowRightIcon } from "lucide-react"

export function WelcomeStep({
  title,
  description,
  logoUrl,
  accent,
  onStart,
}: {
  title: string
  description: string | null
  logoUrl: string | null
  accent: string
  onStart: () => void
}) {
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="flex max-w-lg flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="mb-8 size-20 rounded-2xl object-contain shadow-lg"
          />
        ) : (
          <div
            className="mb-8 flex size-20 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
            style={{ backgroundColor: accent }}
          >
            {initials}
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          {title}
        </h1>

        {description && (
          <p className="mt-4 text-lg leading-relaxed text-stone-500">
            {description}
          </p>
        )}

        <motion.button
          type="button"
          onClick={onStart}
          className="mt-10 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
          style={{ backgroundColor: accent }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Start
          <ArrowRightIcon className="size-4" />
        </motion.button>

        <p className="mt-6 text-xs text-stone-400">
          press <kbd className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 font-mono text-[10px]">Enter ↵</kbd>
        </p>
      </motion.div>
    </div>
  )
}
