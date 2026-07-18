import { useEffect, useState } from "react"

const STORAGE_KEY = "inboundr-os-notepad"

const WELCOME = `Welcome to InboundrOS.

This little desktop is our way of letting you poke around
instead of scrolling another landing page.

A few things to try:
- Open Files and snoop through the press archive
- Beat our high score in Tetris (good luck)
- Change the wallpaper if this one isn't your vibe

Anything you type here stays in your browser. Really.
`

export default function NotepadApp() {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? WELCOME
    } catch {
      return WELCOME
    }
  })

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, text)
      } catch {
        // Storage may be unavailable (private mode); the note just won't persist.
      }
    }, 300)
    return () => window.clearTimeout(id)
  }, [text])

  const lines = text === "" ? 0 : text.split("\n").length
  const chars = text.length

  return (
    <div className="flex h-full flex-col bg-base">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Notepad"
        className="min-h-0 w-full flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed text-text outline-none placeholder:text-text-dim"
        placeholder="Type something…"
      />
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border px-4 font-mono text-[11px] text-text-dim">
        <span>saved to this browser</span>
        <span>
          {lines} {lines === 1 ? "line" : "lines"} · {chars} chars
        </span>
      </div>
    </div>
  )
}
