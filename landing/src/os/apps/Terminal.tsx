import { useEffect, useRef, useState } from "react"
import { useOs } from "../context"
import type { AppProps } from "../types"

const PROMPT = "guest@inboundr-pc:~$"

const NEOFETCH = `        _          guest@inboundr-pc
   o   | |        -----------------
  \\_|_ | |__      OS: InboundrOS 26H2 — Revenue edition
   | | || '_ \\    Host: INBOUNDR-PC (the open web)
   | | || | | |   Kernel: 6.0-deals
   |_|_||_| |_|   Uptime: since your first click
                  CPU: 5x AMD EPYC 9965
                  GPU: Nvidia H200
                  Memory: 512 GB (all of it leads)`

const HELP = `Available commands:
  help                 you are here
  whoami               find out who you really are
  ls                   list files
  cat <file>           read a file
  echo <text>          say it back
  date                 what day it is
  neofetch             flex the specs
  sudo close-deals     close every open deal
  clear                clean up
  exit                 close the terminal

There may be others. Terminals keep secrets.`

const LS = `leads.csv                          memes/
warm-pipeline.csv                  definitely-not-passwords.txt
inbound-playbook-final-v37.docx    aws-bill-DO-NOT-OPEN.png`

interface Line {
  kind: "cmd" | "out"
  text: string
}

const BANNER: Line[] = [
  { kind: "out", text: "InboundrOS Terminal [Version 26H2]" },
  { kind: "out", text: "(c) Inboundr. Some rights reserved, all deals closed." },
  { kind: "out", text: "" },
  { kind: "out", text: "Type 'help' to get started." },
  { kind: "out", text: "" },
]

export default function TerminalApp({ windowId, focused }: AppProps) {
  const { closeWindow, crash, notify } = useOs()
  const [lines, setLines] = useState<Line[]>(BANNER)
  const [input, setInput] = useState("")
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focused) inputRef.current?.focus()
  }, [focused])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const run = (raw: string) => {
    const cmd = raw.trim()
    const echoed: Line[] = [{ kind: "cmd", text: cmd }]
    const out = (...texts: string[]) =>
      setLines((prev) => [...prev, ...echoed, ...texts.map((text) => ({ kind: "out" as const, text })), { kind: "out", text: "" }])

    if (cmd === "") {
      setLines((prev) => [...prev, ...echoed])
      return
    }

    const [name, ...rest] = cmd.split(/\s+/)
    const arg = rest.join(" ")

    switch (name.toLowerCase()) {
      case "help":
        out(...HELP.split("\n"))
        break
      case "whoami":
        out("guest. for now. (login is on the real site)")
        break
      case "ls":
        out(...LS.split("\n"))
        break
      case "cat":
        if (!arg) out("cat: missing file. try 'cat definitely-not-passwords.txt'")
        else if (arg.includes("definitely-not-passwords")) out("hunter2", "", "(kidding. nice try though.)")
        else if (arg.includes("aws-bill")) out("cat: file too large to display. emotionally.")
        else if (arg.includes("leads")) out("cat: permission denied — Inboundr is still working these.")
        else out(`cat: ${arg}: permission denied (it's a marketing site)`)
        break
      case "echo":
        out(arg || "")
        break
      case "date":
        out(new Date().toString())
        break
      case "neofetch":
        out(...NEOFETCH.split("\n"))
        break
      case "sudo":
        if (arg === "close-deals") {
          out("Permission granted.", "Closing deals... done. Inboundr had already handled it.")
          notify("Deals closed", "All open pipeline handled. You're welcome.")
        } else if (arg.startsWith("rm")) {
          setLines((prev) => [...prev, ...echoed, { kind: "out", text: "oh no." }])
          window.setTimeout(crash, 900)
        } else {
          out(`guest is not in the sudoers file. This incident will be reported to sales.`)
        }
        break
      case "rm":
        if (arg.replace(/\s+/g, " ") === "-rf /") {
          setLines((prev) => [...prev, ...echoed, { kind: "out", text: "removing /... this seems bad" }])
          window.setTimeout(crash, 900)
        } else {
          out(`rm: cannot remove '${arg || ""}': these files are load-bearing`)
        }
        break
      case "clear":
        setLines([])
        return
      case "exit":
        closeWindow(windowId)
        return
      default:
        out(`command not found: ${name} (try 'help')`)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      run(input)
      if (input.trim()) {
        setHistory((h) => [...h, input])
      }
      setHistoryIdx(-1)
      setInput("")
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (history.length === 0) return
      const idx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1)
      setHistoryIdx(idx)
      setInput(history[idx])
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIdx === -1) return
      const idx = historyIdx + 1
      if (idx >= history.length) {
        setHistoryIdx(-1)
        setInput("")
      } else {
        setHistoryIdx(idx)
        setInput(history[idx])
      }
    }
  }

  return (
    <div
      className="os-scroll h-full cursor-text overflow-y-auto bg-[#0b0f0d] p-3 font-mono text-[12.5px] leading-relaxed text-[#9fe8c3]"
      ref={scrollRef}
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((line, i) =>
        line.kind === "cmd" ? (
          <div key={i}>
            <span className="text-[#5ddba5]">{PROMPT}</span> <span className="text-text">{line.text}</span>
          </div>
        ) : (
          <div key={i} className="whitespace-pre-wrap">
            {line.text || "\u00a0"}
          </div>
        ),
      )}
      <div className="flex items-center gap-0">
        <span className="shrink-0 text-[#5ddba5]">{PROMPT}&nbsp;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Terminal input"
          className="min-w-0 flex-1 bg-transparent text-text caret-[#5ddba5] outline-none"
        />
      </div>
    </div>
  )
}
