import React, { Suspense, lazy, useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"

const LightRaysCanvas = lazy(() => import("./LightRaysCanvas"))

/**
 * Stand-in for the shader: shown before the WebGL chunk loads, and kept as the
 * permanent backdrop when the context or the chunk fails.
 */
function Poster() {
  return (
    <div
      className="absolute inset-0 bg-base"
      style={{
        backgroundImage: [
          "radial-gradient(70% 55% at 8% 92%, rgba(62,207,142,0.18), transparent 70%)",
          "radial-gradient(55% 45% at 45% 100%, rgba(239,197,84,0.08), transparent 72%)",
          "radial-gradient(90% 60% at 20% 105%, rgba(47,93,80,0.28), transparent 75%)",
        ].join(", "),
      }}
    />
  )
}

class CanvasBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default function LightRays({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting), {
      rootMargin: "10% 0px",
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <Poster />
      <CanvasBoundary fallback={null}>
        <Suspense fallback={null}>
          <LightRaysCanvas animate={!reduceMotion} paused={paused} />
        </Suspense>
      </CanvasBoundary>
    </div>
  )
}
