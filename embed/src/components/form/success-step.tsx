import { motion } from "motion/react"

export function SuccessStep({
  message,
  accent,
}: {
  message: string
  accent: string
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="flex flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div
          className="mb-8 flex size-20 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}15` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
        >
          <motion.svg
            className="size-10"
            style={{ color: accent }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            />
          </motion.svg>
        </motion.div>

        <motion.h2
          className="text-2xl font-bold text-stone-900 sm:text-3xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Thank you!
        </motion.h2>

        <motion.p
          className="mt-3 max-w-md text-lg text-stone-500"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  )
}
