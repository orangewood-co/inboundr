import { useState } from "react"

type Op = "+" | "-" | "*" | "/"

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+": return a + b
    case "-": return a - b
    case "*": return a * b
    case "/": return b === 0 ? NaN : a / b
  }
}

function format(n: number): string {
  if (Number.isNaN(n)) return "cannot divide by zero"
  if (!Number.isFinite(n)) return "too many leads"
  const s = String(Math.round(n * 1e10) / 1e10)
  return s.length > 14 ? n.toExponential(6) : s
}

export default function CalculatorApp() {
  const [display, setDisplay] = useState("0")
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [fresh, setFresh] = useState(true)
  const [quip, setQuip] = useState<string | null>(null)

  const setValue = (value: string) => {
    setDisplay(value)
    setQuip(value === "80085" ? "grow up" : null)
  }

  const pressDigit = (d: string) => {
    if (fresh || display === "0" || quip === "grow up") {
      setValue(d === "." ? "0." : d)
      setFresh(false)
    } else {
      if (d === "." && display.includes(".")) return
      if (display.replace(/[.-]/g, "").length >= 12) return
      setValue(display + d)
    }
  }

  const pressOp = (next: Op) => {
    const current = parseFloat(display)
    if (acc !== null && op && !fresh) {
      const result = compute(acc, current, op)
      setAcc(result)
      setDisplay(format(result))
    } else {
      setAcc(current)
    }
    setOp(next)
    setFresh(true)
    setQuip(null)
  }

  const equals = () => {
    if (acc === null || op === null) return
    const result = compute(acc, parseFloat(display), op)
    setDisplay(format(result))
    setAcc(null)
    setOp(null)
    setFresh(true)
    setQuip(null)
  }

  const clear = () => {
    setDisplay("0")
    setAcc(null)
    setOp(null)
    setFresh(true)
    setQuip(null)
  }

  const negate = () => setValue(display.startsWith("-") ? display.slice(1) : display === "0" ? "0" : `-${display}`)
  const percent = () => setValue(format(parseFloat(display) / 100))

  const KEYS: Array<{ label: string; onPress: () => void; kind?: "op" | "eq" | "fn" }> = [
    { label: "C", onPress: clear, kind: "fn" },
    { label: "+/-", onPress: negate, kind: "fn" },
    { label: "%", onPress: percent, kind: "fn" },
    { label: "÷", onPress: () => pressOp("/"), kind: "op" },
    { label: "7", onPress: () => pressDigit("7") },
    { label: "8", onPress: () => pressDigit("8") },
    { label: "9", onPress: () => pressDigit("9") },
    { label: "×", onPress: () => pressOp("*"), kind: "op" },
    { label: "4", onPress: () => pressDigit("4") },
    { label: "5", onPress: () => pressDigit("5") },
    { label: "6", onPress: () => pressDigit("6") },
    { label: "−", onPress: () => pressOp("-"), kind: "op" },
    { label: "1", onPress: () => pressDigit("1") },
    { label: "2", onPress: () => pressDigit("2") },
    { label: "3", onPress: () => pressDigit("3") },
    { label: "+", onPress: () => pressOp("+"), kind: "op" },
    { label: "0", onPress: () => pressDigit("0") },
    { label: ".", onPress: () => pressDigit(".") },
    { label: "π", onPress: () => { setValue("3.14159265"); setFresh(false) }, kind: "fn" },
    { label: "=", onPress: equals, kind: "eq" },
  ]

  return (
    <div className="flex h-full flex-col bg-base p-3">
      {/* Display */}
      <div className="mb-3 flex min-h-[72px] flex-col items-end justify-end rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3">
        <span className="h-4 font-mono text-[11px] text-text-dim">
          {acc !== null && op ? `${format(acc)} ${op === "*" ? "×" : op === "/" ? "÷" : op}` : "\u00a0"}
        </span>
        <span
          className={`w-full truncate text-right font-mono tracking-tight ${
            quip ? "text-[20px] text-gold" : "text-[30px] text-text"
          }`}
        >
          {quip ?? display}
        </span>
      </div>

      {/* Keys */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-1.5">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={key.onPress}
            className={`rounded-md text-[15px] font-medium transition-all duration-100 active:scale-95 ${
              key.kind === "eq"
                ? "bg-green-bright/90 text-base hover:bg-green-bright"
                : key.kind === "op"
                  ? "bg-white/[0.1] text-green-bright hover:bg-white/[0.16]"
                  : key.kind === "fn"
                    ? "bg-white/[0.05] text-text-muted hover:bg-white/[0.1]"
                    : "bg-white/[0.07] text-text hover:bg-white/[0.12]"
            }`}
          >
            {key.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-center font-mono text-[10px] text-text-dim">
        certified accurate for quotes up to $∞
      </p>
    </div>
  )
}
