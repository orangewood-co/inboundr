/**
 * Embeddable support chat launcher, served as a standalone classic script at /support-widget.js.
 *
 *   <script async src="https://<embed-origin>/support-widget.js" data-organization="<id>"></script>
 *
 * Optional attributes: data-position="left", data-hide-launcher.
 * JavaScript API: InboundrChat("open" | "close" | "toggle" | "shutdown"),
 * InboundrChat("identify", { name, email, phone }).
 * Window events: inboundr:chat:open, inboundr:chat:close, inboundr:chat:unread ({ count }).
 */

declare const __INBOUNDR_API_ORIGIN__: string

type Command = "open" | "close" | "toggle" | "identify" | "shutdown"
type QueuedCall = [Command, unknown?]
type ChatApi = ((command: Command, payload?: unknown) => void) & {
  q?: ArrayLike<unknown>[]
  booted?: boolean
}

type WidgetConfig = { name: string; primaryColor: string }
type Prefill = { name?: string; email?: string; phone?: string }

type MountOptions = {
  config: WidgetConfig
  organization: string
  embedOrigin: string
  position: "left" | "right"
  hideLauncher: boolean
}

declare global {
  interface Window {
    InboundrChat?: ChatApi
  }
}

const CHANNEL = "inboundr:support:v1"
const MOBILE_QUERY = "(max-width: 640px)"
const DEFAULT_ACCENT = "#f5b400"
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const CHAT_ICON =
  '<svg class="icon icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>'
const CLOSE_ICON =
  '<svg class="icon icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
const DISMISS_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'

const STYLES = `
:host { all: initial; }
.root {
  --accent: ${DEFAULT_ACCENT};
  --on-accent: #ffffff;
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --edge: 20px;
  --launcher: 56px;
  --inset-right: var(--edge);
  --inset-left: auto;
  --origin: bottom right;
  --panel-bottom: calc(var(--edge) + var(--launcher) + 16px);
  color: #1c1917;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
.root[data-position="left"] { --inset-right: auto; --inset-left: var(--edge); --origin: bottom left; }
.root[data-launcher="hidden"] { --panel-bottom: var(--edge); }
.root[data-launcher="hidden"] .launcher,
.root[data-launcher="hidden"] .preview { display: none; }

.launcher {
  position: fixed;
  z-index: 2147483000;
  right: var(--inset-right);
  left: var(--inset-left);
  bottom: var(--edge);
  display: grid;
  place-items: center;
  width: var(--launcher);
  height: var(--launcher);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.24);
  -webkit-tap-highlight-color: transparent;
  transition: transform 160ms var(--ease-out), opacity 200ms var(--ease-out);
}
@starting-style { .launcher { opacity: 0; transform: scale(0.9); } }
@media (hover: hover) and (pointer: fine) { .launcher:hover { transform: scale(1.05); } }
.launcher:active { transform: scale(0.95); }
.launcher:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.icon {
  grid-area: 1 / 1;
  width: 26px;
  height: 26px;
  transition: opacity 160ms var(--ease-out), transform 200ms var(--ease-out);
}
.icon-close { opacity: 0; transform: rotate(-90deg) scale(0.8); }
.root[data-open] .icon-chat { opacity: 0; transform: rotate(90deg) scale(0.8); }
.root[data-open] .icon-close { opacity: 1; transform: none; }

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  box-sizing: border-box;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e5484d;
  color: #ffffff;
  box-shadow: 0 0 0 2px #ffffff;
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.badge[hidden] { display: none; }

.panel {
  position: fixed;
  z-index: 2147483000;
  right: var(--inset-right);
  left: var(--inset-left);
  bottom: var(--panel-bottom);
  box-sizing: border-box;
  width: 400px;
  max-width: calc(100vw - 2 * var(--edge));
  height: min(704px, calc(100vh - var(--panel-bottom) - var(--edge)));
  height: min(704px, calc(100dvh - var(--panel-bottom) - var(--edge)));
  overflow: hidden;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 16px 48px -12px rgba(0, 0, 0, 0.32);
  transform-origin: var(--origin);
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  visibility: hidden;
  pointer-events: none;
  transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out), visibility 0s linear 150ms;
}
.root[data-open] .panel {
  opacity: 1;
  transform: none;
  visibility: visible;
  pointer-events: auto;
  transition: opacity 220ms var(--ease-out), transform 220ms var(--ease-out), visibility 0s;
}
.panel iframe {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  opacity: 0;
  transition: opacity 200ms ease;
}
.root[data-ready] .panel iframe { opacity: 1; }
.spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
  border: 2px solid rgba(28, 25, 23, 0.12);
  border-top-color: rgba(28, 25, 23, 0.55);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.root[data-ready] .spinner { display: none; }
@keyframes spin { to { transform: rotate(360deg); } }

.preview {
  position: fixed;
  z-index: 2147483000;
  right: var(--inset-right);
  left: var(--inset-left);
  bottom: calc(var(--edge) + var(--launcher) + 12px);
  display: flex;
  align-items: flex-start;
  box-sizing: border-box;
  width: 300px;
  max-width: calc(100vw - 2 * var(--edge));
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 12px 32px -8px rgba(0, 0, 0, 0.28);
  transform-origin: var(--origin);
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}
@starting-style { .preview { opacity: 0; transform: translateY(6px) scale(0.97); } }
.preview[hidden] { display: none; }
.preview-body {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 12px 4px 12px 14px;
  border: 0;
  border-radius: 14px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.preview-title { color: #78716c; font-size: 12px; font-weight: 600; line-height: 16px; }
.preview-text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.preview-dismiss {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 8px 8px 0 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: #a8a29e;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
@media (hover: hover) and (pointer: fine) {
  .preview-dismiss:hover { background: rgba(28, 25, 23, 0.06); color: #44403c; }
}
.preview-body:focus-visible,
.preview-dismiss:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@media (prefers-color-scheme: dark) {
  .panel { background: #1c1917; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 16px 48px -12px rgba(0, 0, 0, 0.6); }
  .spinner { border-color: rgba(231, 229, 228, 0.14); border-top-color: rgba(231, 229, 228, 0.6); }
}

@media (max-width: 640px) {
  .panel {
    inset: 0;
    width: 100%;
    max-width: none;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
    transform: translateY(16px);
  }
  .root[data-open] .launcher { opacity: 0; pointer-events: none; }
}

@media (prefers-reduced-motion: reduce) {
  .panel,
  .root[data-open] .panel,
  .icon,
  .root[data-open] .icon { transform: none; }
  .launcher:hover,
  .launcher:active { transform: none; }
  @starting-style { .launcher, .preview { transform: none; } }
}
`

function readableTextColor(hex: string): string {
  const digits = hex.slice(1)
  const full = digits.length === 3 ? digits.replace(/./g, "$&$&") : digits
  const value = Number.parseInt(full, 16)
  const luminance = (0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255
  return luminance > 0.62 ? "#1c1917" : "#ffffff"
}

function storageGet(kind: "localStorage" | "sessionStorage", key: string): string | null {
  try {
    return window[kind].getItem(key)
  } catch {
    return null
  }
}

function storageSet(kind: "localStorage" | "sessionStorage", key: string, value: string | null) {
  try {
    if (value === null) window[kind].removeItem(key)
    else window[kind].setItem(key, value)
  } catch {
    // Storage can be blocked by browser privacy settings; the chat still works for this page view.
  }
}

function toPrefill(input: unknown): Prefill {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const pick = (key: string, maxLength: number) => {
    const value = source[key]
    return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : undefined
  }
  return { name: pick("name", 120), email: pick("email", 254), phone: pick("phone", 32) }
}

function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(callback, { timeout: 4000 })
  else window.setTimeout(callback, 1500)
}

function mount({ config, organization, embedOrigin, position, hideLauncher }: MountOptions) {
  const sessionKey = `inboundr-chat:${organization}`
  const openKey = `${sessionKey}:open`
  const accent = HEX_COLOR.test(config.primaryColor) ? config.primaryColor : DEFAULT_ACCENT

  // A custom tag keeps generic host-page selectors like `body > div` from styling the container.
  const host = document.createElement("inboundr-chat")
  const shadow = host.attachShadow({ mode: "closed" })
  shadow.innerHTML = `<style>${STYLES}</style>
<div class="root">
  <div class="panel" id="inboundr-chat-panel" role="dialog"><span class="spinner" aria-hidden="true"></span></div>
  <div class="preview" hidden>
    <button class="preview-body" type="button"><span class="preview-title"></span><span class="preview-text"></span></button>
    <button class="preview-dismiss" type="button" aria-label="Dismiss message">${DISMISS_ICON}</button>
  </div>
  <button class="launcher" type="button" aria-controls="inboundr-chat-panel" aria-expanded="false">
    ${CHAT_ICON}${CLOSE_ICON}<span class="badge" aria-hidden="true" hidden></span>
  </button>
</div>`

  const select = <T extends Element>(selector: string) => shadow.querySelector(selector) as T
  const root = select<HTMLDivElement>(".root")
  const panel = select<HTMLDivElement>(".panel")
  const launcher = select<HTMLButtonElement>(".launcher")
  const badge = select<HTMLSpanElement>(".badge")
  const preview = select<HTMLDivElement>(".preview")
  const previewText = select<HTMLSpanElement>(".preview-text")

  root.dataset.position = position
  if (hideLauncher) root.dataset.launcher = "hidden"
  root.style.setProperty("--accent", accent)
  root.style.setProperty("--on-accent", readableTextColor(accent))
  panel.setAttribute("aria-label", `Chat with ${config.name}`)
  panel.inert = true
  select<HTMLSpanElement>(".preview-title").textContent = config.name

  let isOpen = false
  let unread = 0
  let frame: HTMLIFrameElement | null = null
  let frameReady = false
  let focusOnReady = false
  let prefill: Prefill | null = null
  let restoreOverflow: string | null = null

  function post(message: Record<string, unknown>) {
    if (!frameReady || !frame?.contentWindow) return
    frame.contentWindow.postMessage({ channel: CHANNEL, ...message }, embedOrigin)
  }

  function ensureFrame(): HTMLIFrameElement {
    if (frame) return frame
    const params = new URLSearchParams({ embed: "1", parentOrigin: window.location.origin })
    // The visitor's session lives in first-party storage so it survives third-party storage partitioning.
    const token = storageGet("localStorage", sessionKey)
    frame = document.createElement("iframe")
    frame.title = `Chat with ${config.name}`
    frame.allow = "microphone; autoplay; clipboard-write"
    frame.src = `${embedOrigin}/support/${encodeURIComponent(organization)}?${params}${
      token ? `#session=${encodeURIComponent(token)}` : ""
    }`
    panel.appendChild(frame)
    return frame
  }

  function renderBadge() {
    badge.hidden = unread === 0 || isOpen
    badge.textContent = unread > 9 ? "9+" : String(unread)
    launcher.setAttribute(
      "aria-label",
      isOpen
        ? "Close support chat"
        : unread > 0
          ? `Open support chat, ${unread} unread ${unread === 1 ? "message" : "messages"}`
          : "Open support chat"
    )
  }

  function lockPageScroll(lock: boolean) {
    const page = document.documentElement
    if (lock && window.matchMedia(MOBILE_QUERY).matches) {
      restoreOverflow ??= page.style.overflow
      page.style.overflow = "hidden"
    } else if (!lock && restoreOverflow !== null) {
      page.style.overflow = restoreOverflow
      restoreOverflow = null
    }
  }

  function setOpen(next: boolean, requestFocus = true) {
    if (next === isOpen) return
    const chatHadFocus = shadow.activeElement === frame
    // Focusing the composer on phones would pop the keyboard over the conversation.
    const focus = requestFocus && !window.matchMedia(MOBILE_QUERY).matches
    isOpen = next
    storageSet("sessionStorage", openKey, next ? "1" : null)
    if (next) ensureFrame()
    root.toggleAttribute("data-open", next)
    panel.inert = !next
    launcher.setAttribute("aria-expanded", String(next))
    preview.hidden = true
    renderBadge()
    lockPageScroll(next)
    if (next && focus) {
      frame?.focus()
      focusOnReady = !frameReady
    }
    if (!next && chatHadFocus) {
      if (hideLauncher) frame?.blur()
      else launcher.focus()
    }
    post({ type: "visibility", open: next, focus: next && focus })
    window.dispatchEvent(new CustomEvent(next ? "inboundr:chat:open" : "inboundr:chat:close"))
  }

  function setUnread(count: number, previewMessage: string) {
    const next = Math.max(0, Math.floor(count))
    if (next === unread) return
    const increased = next > unread
    unread = next
    renderBadge()
    if (unread === 0) {
      preview.hidden = true
    } else if (increased && !isOpen && previewMessage) {
      previewText.textContent = previewMessage
      preview.hidden = false
    }
    window.dispatchEvent(new CustomEvent("inboundr:chat:unread", { detail: { count: unread } }))
  }

  function shutdown() {
    setOpen(false, false)
    storageSet("localStorage", sessionKey, null)
    prefill = null
    frame?.remove()
    frame = null
    frameReady = false
    root.removeAttribute("data-ready")
    setUnread(0, "")
  }

  window.addEventListener("message", (event) => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== embedOrigin) return
    const data = event.data as Record<string, unknown> | null
    if (!data || data.channel !== CHANNEL) return
    switch (data.type) {
      case "ready":
        frameReady = true
        root.setAttribute("data-ready", "")
        post({ type: "visibility", open: isOpen, focus: isOpen && focusOnReady })
        focusOnReady = false
        if (prefill) post({ type: "prefill", ...prefill })
        break
      case "close":
        setOpen(false)
        break
      case "session":
        storageSet("localStorage", sessionKey, typeof data.token === "string" && data.token ? data.token : null)
        break
      case "unread":
        setUnread(Number(data.count) || 0, typeof data.preview === "string" ? data.preview : "")
        break
    }
  })

  launcher.addEventListener("click", () => setOpen(!isOpen))
  launcher.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) setOpen(false)
  })
  // Start loading the chat as soon as the visitor shows intent, so it's warm by the time they click.
  launcher.addEventListener("pointerenter", ensureFrame, { once: true })
  launcher.addEventListener("focus", ensureFrame, { once: true })
  select<HTMLButtonElement>(".preview-body").addEventListener("click", () => setOpen(true))
  select<HTMLButtonElement>(".preview-dismiss").addEventListener("click", () => {
    preview.hidden = true
  })

  renderBadge()
  document.body.appendChild(host)

  if (storageGet("sessionStorage", openKey) === "1" && !window.matchMedia(MOBILE_QUERY).matches) {
    setOpen(true, false)
  } else if (storageGet("localStorage", sessionKey)) {
    // Returning visitors keep a live connection so replies surface as a badge and preview.
    whenIdle(ensureFrame)
  }

  return (command: Command, payload?: unknown) => {
    switch (command) {
      case "open":
        setOpen(true)
        break
      case "close":
        setOpen(false)
        break
      case "toggle":
        setOpen(!isOpen)
        break
      case "identify":
        prefill = toPrefill(payload)
        post({ type: "prefill", ...prefill })
        break
      case "shutdown":
        shutdown()
        break
      default:
        console.warn(`[Inboundr Chat] Unknown command: ${String(command)}`)
    }
  }
}

function boot() {
  const script = document.currentScript
  if (!(script instanceof HTMLScriptElement) || !script.src) return
  const existing = window.InboundrChat
  if (existing?.booted) return

  const organization = script.dataset.organization?.trim() ?? ""
  if (!organization) {
    console.error("[Inboundr Chat] The widget script tag needs a data-organization attribute.")
    return
  }

  const options = {
    organization,
    embedOrigin: new URL(script.src, document.baseURI).origin,
    position: script.dataset.position === "left" ? ("left" as const) : ("right" as const),
    hideLauncher: script.dataset.hideLauncher !== undefined && script.dataset.hideLauncher !== "false",
  }

  // Calls made through the optional queue stub before this script loaded are replayed once mounted.
  const queued: QueuedCall[] = Array.from(existing?.q ?? [], (call) => Array.from(call) as QueuedCall)
  let execute: ((command: Command, payload?: unknown) => void) | null = null
  const api: ChatApi = (command, payload) => {
    if (execute) execute(command, payload)
    else queued.push([command, payload])
  }
  api.booted = true
  window.InboundrChat = api

  const configRequest = fetch(
    `${__INBOUNDR_API_ORIGIN__}/api/v1/public/support/widget/${encodeURIComponent(organization)}`,
    { credentials: "omit" }
  )
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { widget?: WidgetConfig } | null) => body?.widget ?? null)
    .catch(() => null)

  const start = () => {
    void configRequest.then((config) => {
      if (!config) {
        console.warn("[Inboundr Chat] Support chat is not available for this workspace.")
        queued.length = 0
        return
      }
      const run = mount({ config, ...options })
      execute = run
      for (const [command, payload] of queued.splice(0)) run(command, payload)
    })
  }

  if (document.body) start()
  else document.addEventListener("DOMContentLoaded", start, { once: true })
}

boot()
