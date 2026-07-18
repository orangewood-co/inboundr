import { useMemo, useReducer } from "react"
import type { AppId } from "./types"
import { getApp } from "./apps/registry"

export interface OsWindowState {
  id: number
  appId: AppId
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
  payload?: unknown
}

interface ManagerState {
  windows: OsWindowState[]
  nextId: number
  nextZ: number
}

type Action =
  | { type: "OPEN"; appId: AppId; payload?: unknown; viewport: { w: number; h: number } }
  | { type: "CLOSE"; id: number }
  | { type: "FOCUS"; id: number }
  | { type: "MINIMIZE"; id: number }
  | { type: "TOGGLE_MAXIMIZE"; id: number }
  | { type: "MOVE"; id: number; x: number; y: number }

const TASKBAR_H = 52

function clampPosition(x: number, y: number, w: number, viewport: { w: number; h: number }) {
  return {
    x: Math.min(Math.max(x, 16 - w + 120), Math.max(16, viewport.w - 120)),
    y: Math.min(Math.max(y, 0), Math.max(0, viewport.h - TASKBAR_H - 40)),
  }
}

function reducer(state: ManagerState, action: Action): ManagerState {
  switch (action.type) {
    case "OPEN": {
      const existing = state.windows.find((win) => win.appId === action.appId)
      if (existing) {
        // Single instance per app: re-opening focuses (and re-targets) it.
        return {
          ...state,
          nextZ: state.nextZ + 1,
          windows: state.windows.map((win) =>
            win.id === existing.id
              ? {
                  ...win,
                  minimized: false,
                  z: state.nextZ,
                  payload: action.payload ?? win.payload,
                }
              : win,
          ),
        }
      }

      const app = getApp(action.appId)
      const w = Math.min(app.defaultSize.w, action.viewport.w - 24)
      const h = Math.min(app.defaultSize.h, action.viewport.h - TASKBAR_H - 24)
      // Cascade new windows from the upper-left third of the desktop.
      const offset = (state.nextId % 6) * 28
      const { x, y } = clampPosition(
        Math.round((action.viewport.w - w) / 2) + offset - 70,
        Math.round((action.viewport.h - TASKBAR_H - h) / 2.4) + offset,
        w,
        action.viewport,
      )

      return {
        nextId: state.nextId + 1,
        nextZ: state.nextZ + 1,
        windows: [
          ...state.windows,
          {
            id: state.nextId,
            appId: action.appId,
            x,
            y,
            w,
            h,
            z: state.nextZ,
            minimized: false,
            maximized: false,
            payload: action.payload,
          },
        ],
      }
    }
    case "CLOSE":
      return { ...state, windows: state.windows.filter((win) => win.id !== action.id) }
    case "FOCUS": {
      const target = state.windows.find((win) => win.id === action.id)
      if (!target) return state
      if (!target.minimized && target.z === state.nextZ - 1) return state
      return {
        ...state,
        nextZ: state.nextZ + 1,
        windows: state.windows.map((win) =>
          win.id === action.id ? { ...win, minimized: false, z: state.nextZ } : win,
        ),
      }
    }
    case "MINIMIZE":
      return {
        ...state,
        windows: state.windows.map((win) =>
          win.id === action.id ? { ...win, minimized: true } : win,
        ),
      }
    case "TOGGLE_MAXIMIZE":
      return {
        ...state,
        nextZ: state.nextZ + 1,
        windows: state.windows.map((win) =>
          win.id === action.id
            ? { ...win, maximized: !win.maximized, minimized: false, z: state.nextZ }
            : win,
        ),
      }
    case "MOVE":
      return {
        ...state,
        windows: state.windows.map((win) =>
          win.id === action.id ? { ...win, x: action.x, y: action.y } : win,
        ),
      }
    default:
      return state
  }
}

export interface WindowManager {
  windows: OsWindowState[]
  /** Id of the top-most non-minimized window, or null when the desktop is bare. */
  focusedId: number | null
  open: (appId: AppId, payload?: unknown) => void
  close: (id: number) => void
  focus: (id: number) => void
  minimize: (id: number) => void
  toggleMaximize: (id: number) => void
  move: (id: number, x: number, y: number) => void
}

export const OS_TASKBAR_HEIGHT = TASKBAR_H

export function useWindowManager(): WindowManager {
  const [state, dispatch] = useReducer(reducer, { windows: [], nextId: 1, nextZ: 1 })

  const focusedId = useMemo(() => {
    let top: OsWindowState | null = null
    for (const win of state.windows) {
      if (win.minimized) continue
      if (!top || win.z > top.z) top = win
    }
    return top?.id ?? null
  }, [state.windows])

  return useMemo(
    () => ({
      windows: state.windows,
      focusedId,
      open: (appId, payload) =>
        dispatch({
          type: "OPEN",
          appId,
          payload,
          viewport: { w: window.innerWidth, h: window.innerHeight },
        }),
      close: (id) => dispatch({ type: "CLOSE", id }),
      focus: (id) => dispatch({ type: "FOCUS", id }),
      minimize: (id) => dispatch({ type: "MINIMIZE", id }),
      toggleMaximize: (id) => dispatch({ type: "TOGGLE_MAXIMIZE", id }),
      move: (id, x, y) => dispatch({ type: "MOVE", id, x, y }),
    }),
    [state.windows, focusedId],
  )
}
