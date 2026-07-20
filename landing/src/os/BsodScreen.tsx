import { useEffect, useRef, useState } from "react"

/**
 * Deterministic fake QR code — it scans as nothing, which is the joke.
 * Seeded so it doesn't flicker between renders.
 */
const QR_SIZE = 11
const QR_CELLS: boolean[] = (() => {
  const cells: boolean[] = []
  let seed = 1337
  for (let i = 0; i < QR_SIZE * QR_SIZE; i++) {
    seed = (seed * 16807) % 2147483647
    cells.push(seed % 100 < 48)
  }
  return cells
})()

export default function BsodScreen({ onReboot }: { onReboot: () => void }) {
  const [progress, setProgress] = useState(0)
  const armed = useRef(false)

  useEffect(() => {
    // Small delay so the keypress/click that caused the crash can't instantly reboot.
    const armTimer = window.setTimeout(() => {
      armed.current = true
    }, 800)
    const onAnyInput = () => {
      if (armed.current) onReboot()
    }
    window.addEventListener("keydown", onAnyInput)
    window.addEventListener("pointerdown", onAnyInput)
    return () => {
      window.clearTimeout(armTimer)
      window.removeEventListener("keydown", onAnyInput)
      window.removeEventListener("pointerdown", onAnyInput)
    }
  }, [onReboot])

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((p) => {
        // Hangs at 99% like the real thing.
        if (p >= 99) return 99
        return Math.min(99, p + Math.floor(Math.random() * 14) + 4)
      })
    }, 700)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="absolute inset-0 z-[9600] flex cursor-default select-none items-center justify-center bg-[#0067b8] text-white"
      role="alert"
    >
      <div className="w-full max-w-2xl px-8">
        <p className="text-[96px] font-light leading-none">:(</p>
        <p className="mt-8 text-[22px] leading-snug">
          Your PC ran into a problem: it ran out of inbound leads to close. We're just collecting
          some pipeline, and then Inboundr will restart it for you.
        </p>
        <p className="mt-6 text-[22px]">{progress}% complete</p>

        <div className="mt-10 flex items-start gap-5">
          <div
            className="grid shrink-0 gap-px bg-white p-1.5"
            style={{ gridTemplateColumns: `repeat(${QR_SIZE}, 6px)` }}
            aria-hidden
          >
            {QR_CELLS.map((filled, i) => (
              <span key={i} className={`h-1.5 w-1.5 ${filled ? "bg-[#0067b8]" : "bg-white"}`} />
            ))}
          </div>
          <div className="text-[12.5px] leading-relaxed text-white/90">
            <p>For more information about this issue and possible fixes, visit inboundr.co</p>
            <p className="mt-3">If you call a support person, give them this info:</p>
            <p className="mt-1 font-mono">Stop code: OUT_OF_LEADS</p>
            <p className="font-mono">What failed: cold-outreach.sys</p>
          </div>
        </div>

        <p className="mt-10 text-[12.5px] text-white/70">Press any key to restart InboundrOS.</p>
      </div>
    </div>
  )
}
