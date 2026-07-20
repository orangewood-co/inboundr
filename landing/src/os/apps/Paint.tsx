import { useEffect, useRef, useState } from "react"
import { Download, Eraser, Trash2 } from "lucide-react"

const COLORS = ["#f4f4f2", "#3ecf8e", "#efc554", "#e08c7d", "#7db3e8", "#b48ce0"]
const CANVAS_BG = "#101412"
const SIZES = [3, 7, 14]

export default function PaintApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState(COLORS[1])
  const [size, setSize] = useState(SIZES[1])
  const [erasing, setErasing] = useState(false)
  const [touched, setTouched] = useState(false)

  // Size the canvas buffer to its element, preserving the drawing on resize.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const fill = (ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = CANVAS_BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (canvas.width === Math.round(width) && canvas.height === Math.round(height)) return
      const snapshot = document.createElement("canvas")
      snapshot.width = canvas.width
      snapshot.height = canvas.height
      snapshot.getContext("2d")?.drawImage(canvas, 0, 0)
      canvas.width = Math.round(width)
      canvas.height = Math.round(height)
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      fill(ctx)
      ctx.drawImage(snapshot, 0, 0)
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  const pointOf = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    ctx.strokeStyle = erasing ? CANVAS_BG : color
    ctx.lineWidth = erasing ? size * 2.5 : size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  const onDown = (e: React.PointerEvent) => {
    drawing.current = true
    setTouched(true)
    const p = pointOf(e)
    last.current = p
    stroke(p, p)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const p = pointOf(e)
    stroke(last.current, p)
    last.current = p
  }

  const onUp = () => {
    drawing.current = false
    last.current = null
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.fillStyle = CANVAS_BG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setTouched(false)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = "masterpiece.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.06] px-3">
        <div className="flex items-center gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => {
                setColor(c)
                setErasing(false)
              }}
              className={`size-6 rounded-full border-2 transition-transform duration-100 active:scale-90 ${
                color === c && !erasing ? "scale-110 border-white" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="h-5 w-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              title={`Brush ${s}px`}
              onClick={() => setSize(s)}
              className={`flex size-7 items-center justify-center rounded-md transition-colors duration-100 ${
                size === s ? "bg-white/[0.14]" : "hover:bg-white/[0.07]"
              }`}
            >
              <span
                className="rounded-full bg-text"
                style={{ width: Math.min(s + 3, 16), height: Math.min(s + 3, 16) }}
              />
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-white/10" />
        <button
          type="button"
          title="Eraser"
          onClick={() => setErasing(!erasing)}
          aria-pressed={erasing}
          className={`flex size-7 items-center justify-center rounded-md transition-colors duration-100 ${
            erasing ? "bg-green-bright/90 text-base" : "text-text-muted hover:bg-white/[0.07]"
          }`}
        >
          <Eraser className="size-4" strokeWidth={1.75} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          title="Clear canvas"
          onClick={clear}
          className="flex size-7 items-center justify-center rounded-md text-text-muted transition-colors duration-100 hover:bg-white/[0.07] hover:text-text"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={save}
          className="flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.07] px-2.5 py-1 text-[12px] font-medium transition-colors duration-150 hover:bg-white/[0.14]"
        >
          <Download className="size-3.5" /> Save
        </button>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        />
        {!touched && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] text-text-dim">
            Draw something. It saves as masterpiece.png — we don't make the rules.
          </p>
        )}
      </div>
    </div>
  )
}
