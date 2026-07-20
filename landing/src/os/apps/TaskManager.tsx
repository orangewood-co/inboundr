import { useEffect, useState } from "react"
import { Activity } from "lucide-react"
import { useOs } from "../context"

interface Proc {
  id: string
  name: string
  status: "Running" | "Not responding" | "Relentless"
  /** Base CPU %; jittered every tick for realism. */
  cpu: number
  mem: string
  killable?: boolean
}

const PROCESSES: Proc[] = [
  { id: "lead-responder", name: "lead-responder.exe", status: "Running", cpu: 0.2, mem: "84.1 MB" },
  { id: "quote-engine", name: "quote-engine.exe", status: "Running", cpu: 1.4, mem: "212.7 MB" },
  { id: "follow-up", name: "follow-up-daemon", status: "Relentless", cpu: 3.1, mem: "96.4 MB" },
  { id: "voice-agent", name: "voice-agent.exe", status: "Running", cpu: 0.8, mem: "158.0 MB" },
  { id: "pipeline", name: "pipeline-sync.exe", status: "Running", cpu: 0.4, mem: "45.2 MB" },
  { id: "cold-outreach", name: "cold-outreach.exe", status: "Not responding", cpu: 97.3, mem: "1.9 GB", killable: true },
  { id: "focus", name: "focus-mode.sys", status: "Running", cpu: 0.0, mem: "2.1 MB" },
  { id: "tetris-hs", name: "tetris-highscore-guard.exe", status: "Running", cpu: 0.1, mem: "13.3 MB" },
]

export default function TaskManagerApp() {
  const { notify } = useOs()
  const [killed, setKilled] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1500)
    return () => window.clearInterval(id)
  }, [])

  const procs = PROCESSES.filter((p) => !(killed && p.id === "cold-outreach"))
  const selectedProc = procs.find((p) => p.id === selected)

  // Deterministic-ish jitter so numbers wiggle like a real task manager.
  const cpuOf = (p: Proc) => {
    if (p.status === "Not responding") return p.cpu
    const jitter = Math.sin(tick * 1.7 + p.name.length) * 0.3
    return Math.max(0, p.cpu + jitter)
  }

  const totalCpu = procs.reduce((sum, p) => sum + cpuOf(p), 0)

  const endTask = () => {
    if (!selectedProc) return
    if (selectedProc.killable) {
      setKilled(true)
      setSelected(null)
      notify("cold-outreach.exe ended", "Nothing of value was lost.")
    } else {
      notify("Access denied", `${selectedProc.name} is load-bearing. Inboundr needs it.`)
    }
  }

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <Activity className="size-3.5 text-green-bright" /> Processes
        </span>
        <span className="font-mono text-[11px] text-text-dim">
          CPU {totalCpu.toFixed(1)}% · 512 GB available
        </span>
      </div>

      {/* Column headers */}
      <div className="grid shrink-0 grid-cols-[1fr_110px_64px_80px] gap-2 border-b border-white/[0.06] px-4 py-1.5 text-[10.5px] font-semibold text-text-dim">
        <span>Name</span>
        <span>Status</span>
        <span className="text-right">CPU</span>
        <span className="text-right">Memory</span>
      </div>

      {/* Rows */}
      <div className="os-scroll min-h-0 flex-1 overflow-y-auto">
        {procs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(selected === p.id ? null : p.id)}
            className={`grid w-full grid-cols-[1fr_110px_64px_80px] items-center gap-2 px-4 py-2 text-left transition-colors duration-100 ${
              selected === p.id ? "bg-green-bright/15" : "hover:bg-white/[0.04]"
            }`}
          >
            <span className="truncate font-mono text-[12px]">{p.name}</span>
            <span
              className={`text-[11px] ${
                p.status === "Not responding"
                  ? "text-[#e08c7d]"
                  : p.status === "Relentless"
                    ? "text-gold"
                    : "text-text-dim"
              }`}
            >
              {p.status}
            </span>
            <span
              className={`text-right font-mono text-[11.5px] ${
                cpuOf(p) > 50 ? "text-[#e08c7d]" : "text-text-muted"
              }`}
            >
              {cpuOf(p).toFixed(1)}%
            </span>
            <span className="text-right font-mono text-[11.5px] text-text-muted">{p.mem}</span>
          </button>
        ))}
        {killed && (
          <p className="px-4 py-3 font-mono text-[11px] text-text-dim">
            cold-outreach.exe was ended. System performance improved by 97.3%.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex h-11 shrink-0 items-center justify-between border-t border-white/[0.06] px-4">
        <span className="font-mono text-[11px] text-text-dim">{procs.length} processes</span>
        <button
          type="button"
          onClick={endTask}
          disabled={!selectedProc}
          className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
            selectedProc
              ? "border-white/15 bg-white/[0.07] text-text hover:bg-white/[0.14]"
              : "border-white/[0.06] text-text-dim"
          }`}
        >
          End task
        </button>
      </div>
    </div>
  )
}
