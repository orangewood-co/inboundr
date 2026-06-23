import type { ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { TetrisBoard } from "@/components/TetrisBoard"
import { useBoardLayout } from "@/hooks/useBoardLayout"
import { useTetris } from "@/hooks/useTetris"
import { PIECE_COLORS, pieceCells, type PieceType } from "@/lib/tetris"

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

function Reveal({
  children,
  className,
  delay,
  reduceMotion,
}: {
  children: ReactNode
  className: string
  delay: number
  reduceMotion: boolean
}) {
  return (
    <span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]">
      <motion.span
        className={className}
        initial={reduceMotion ? { opacity: 0 } : { y: "110%" }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: 0.9, delay, ease: EASE }}
      >
        {children}
      </motion.span>
    </span>
  )
}

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-surface px-1 font-mono text-[10px] leading-none text-text-muted">
      {children}
    </span>
  )
}

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-text-dim">
      <span className="label-sm">{label}</span>
      <span className="flex gap-1">{children}</span>
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="label-sm text-text-dim">{label}</span>
      <span className="font-mono text-sm tabular-nums text-text">{value}</span>
    </span>
  )
}

function NextPreview({ type }: { type: PieceType | null }) {
  const size = 7
  if (!type) return <span className="inline-block" style={{ width: size * 4, height: size * 2 }} />
  const cells = pieceCells(type, 0)
  const xs = cells.map(([x]) => x)
  const ys = cells.map(([, y]) => y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX + 1
  const h = Math.max(...ys) - minY + 1
  return (
    <span className="relative inline-block align-middle" style={{ width: w * size, height: h * size }}>
      {cells.map(([x, y], i) => (
        <span
          key={i}
          className="absolute rounded-[1px]"
          style={{
            left: (x - minX) * size,
            top: (y - minY) * size,
            width: size - 1,
            height: size - 1,
            background: PIECE_COLORS[type],
          }}
        />
      ))}
    </span>
  )
}

function Overlay({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-base/70 px-6 text-center backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <motion.div
        className="flex flex-col items-center"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function TouchButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-12 flex-1 items-center justify-center rounded-md border border-border bg-surface text-lg text-text-muted transition-[transform,background-color,color] duration-150 ease-out active:scale-95 active:bg-surface-raised active:text-text"
    >
      {children}
    </button>
  )
}

export default function NotFound() {
  const location = useLocation()
  const reduceMotion = useReducedMotion() ?? false
  const layout = useBoardLayout()
  const game = useTetris(layout.cols)

  const rawPath = location.pathname
  const path = rawPath.length > 28 ? rawPath.slice(0, 27) + "\u2026" : rawPath

  return (
    <>
      <title>404 — Page not found · Inboundr</title>

      <section className="relative overflow-hidden">
        {/* ── Heading ── */}
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-10 sm:pt-28 lg:px-8">
          <motion.p
            className="label mb-6 text-green-bright"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
          >
            Error 404
          </motion.p>
          <h1 className="max-w-3xl">
            <Reveal
              className="block text-[clamp(2rem,5vw,3.75rem)] font-light leading-[1.02] tracking-[-0.03em] text-text"
              delay={0.12}
              reduceMotion={reduceMotion}
            >
              The page &ldquo;{path}&rdquo; wasn&rsquo;t found.
            </Reveal>
            <Reveal
              className="block font-display text-[clamp(2.25rem,6vw,4.5rem)] italic leading-[1.0] tracking-[-0.02em] text-gold"
              delay={0.24}
              reduceMotion={reduceMotion}
            >
              Let&rsquo;s find a better place.
            </Reveal>
          </h1>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-4"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-text px-7 py-3.5 text-sm font-semibold text-base transition-shadow duration-200 hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
              >
                Go to homepage <ArrowRight className="size-4" />
              </Link>
            </motion.div>
            <p className="text-sm text-text-muted">Or clear a few lines while you&rsquo;re here.</p>
          </motion.div>
        </div>

        {/* ── Status strip ── */}
        <motion.div
          className="border-y border-border bg-base/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5 lg:px-8">
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="label-sm text-green-bright">404 Tetris</span>
              <Stat label="Level" value={game.level} />
              <Stat label="Lines" value={game.lines} />
              <Stat label="Score" value={game.score} />
              <span className="hidden items-center gap-2 sm:flex">
                <span className="label-sm text-text-dim">Next</span>
                <NextPreview type={game.next} />
              </span>
            </div>
            <div className="hidden items-center gap-4 md:flex lg:gap-5">
              <Hint label="Move">
                <Key>&larr;</Key>
                <Key>&rarr;</Key>
              </Hint>
              <Hint label="Rotate">
                <Key>&uarr;</Key>
              </Hint>
              <Hint label="Drop">
                <Key>Space</Key>
              </Hint>
              <Hint label="Pause">
                <Key>P</Key>
              </Hint>
              <Hint label="Restart">
                <Key>R</Key>
              </Hint>
            </div>
          </div>
        </motion.div>

        {/* ── Board ── */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
        >
          <TetrisBoard
            board={game.board}
            active={game.active}
            ghostY={game.ghostY}
            clearing={game.clearing}
            reduceMotion={reduceMotion}
            layout={layout}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-base" />

          <AnimatePresence>
            {game.status === "paused" && (
              <Overlay key="paused" reduceMotion={reduceMotion}>
                <p className="font-display text-4xl italic text-text">Paused</p>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-text-muted">
                  Press <Key>P</Key> to resume
                </p>
              </Overlay>
            )}
            {game.status === "over" && (
              <Overlay key="over" reduceMotion={reduceMotion}>
                <p className="label-sm text-text-dim">Game over</p>
                <p className="mt-3 font-display text-5xl italic text-gold tabular-nums">{game.score}</p>
                <p className="mt-1 text-sm text-text-muted">Final score &middot; Level {game.level}</p>
                <div className="mt-7 flex items-center gap-4">
                  <motion.button
                    type="button"
                    onClick={game.actions.restart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-text px-6 py-3 text-sm font-semibold text-base"
                  >
                    Play again
                  </motion.button>
                  <Link
                    to="/"
                    className="link-underline inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors duration-200 hover:text-text"
                  >
                    Go home <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </Overlay>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Mobile controls ── */}
        <div className="border-t border-border px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <TouchButton onClick={game.actions.moveLeft} label="Move left">
              &larr;
            </TouchButton>
            <TouchButton onClick={game.actions.rotate} label="Rotate">
              &#8635;
            </TouchButton>
            <TouchButton onClick={game.actions.moveRight} label="Move right">
              &rarr;
            </TouchButton>
            <TouchButton onClick={game.actions.softDrop} label="Soft drop">
              &darr;
            </TouchButton>
            <TouchButton onClick={game.actions.hardDrop} label="Hard drop">
              &#8675;
            </TouchButton>
          </div>
        </div>
      </section>
    </>
  )
}
