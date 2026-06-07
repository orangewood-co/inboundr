import { type ButtonHTMLAttributes, type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  AlertCircleIcon,
  CameraIcon,
  CheckCircle2Icon,
  LoaderIcon,
  MapPinIcon,
  UploadIcon,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_ORIGIN } from "@/lib/env"

type AttendanceAction = "check_in" | "check_out"

type Workspace = {
  _id: string
  name: string
  logoUrl: string
  primaryColor: string
}

type Employee = {
  _id: string
  employeeCode: string | null
  fullName: string
  title: string | null
}

type AttendanceRecord = {
  _id: string
  workDate: string
  checkInAt: string | null
  checkOutAt: string | null
  status: string
}

type LocationPayload = {
  latitude: number
  longitude: number
  accuracy: number | null
  capturedAt: string
}

const KIOSK_BTN_BASE =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2"
const KIOSK_BTN_PRIMARY =
  "bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
const KIOSK_BTN_SECONDARY =
  "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"

function KioskButton({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      className={`${KIOSK_BTN_BASE} ${variant === "primary" ? KIOSK_BTN_PRIMARY : KIOSK_BTN_SECONDARY} ${className}`}
      {...props}
    />
  )
}

function CapturedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
      <CheckCircle2Icon className="size-3.5" />
      Captured
    </span>
  )
}

function localWorkDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function actionLabel(action: AttendanceAction) {
  return action === "check_in" ? "Check In" : "Check Out"
}

function formatTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function blobFromDataUrl(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",")
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg"
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

export default function AttendancePage({ organizationId }: { organizationId: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [logoBroken, setLogoBroken] = useState(false)
  const [employeeCode, setEmployeeCode] = useState("")
  const [pin, setPin] = useState("")
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [record, setRecord] = useState<AttendanceRecord | null>(null)
  const [nextAction, setNextAction] = useState<AttendanceAction>("check_in")
  const [location, setLocation] = useState<LocationPayload | null>(null)
  const [selfieDataUrl, setSelfieDataUrl] = useState("")
  const [working, setWorking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workDate = useMemo(localWorkDate, [])
  const apiBase = `${API_ORIGIN}/api/v1/public/attendance/${organizationId}`

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const clockTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now)
  const clockDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now)

  useEffect(() => {
    fetch(apiBase)
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "Attendance workspace is unavailable")
        return body
      })
      .then((body) => setWorkspace(body.organization))
      .catch((err) => setError(err instanceof Error ? err.message : "Attendance workspace is unavailable"))
      .finally(() => setLoading(false))
  }, [apiBase])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (employee && !record?.checkOutAt) {
      void startCamera()
    }
  }, [employee, record?.checkOutAt])

  async function identify(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setWorking(true)
    setError(null)
    try {
      const response = await fetch(`${apiBase}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode, pin, workDate }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Unable to identify employee")
      setEmployee(body.employee)
      setRecord(body.record ?? null)
      setNextAction(body.nextAction ?? "check_in")
      await requestLocation()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to identify employee")
    } finally {
      setWorking(false)
    }
  }

  async function requestLocation() {
    if (!navigator.geolocation) {
      throw new Error("Location is not supported by this browser")
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
      })
    }).catch(() => {
      throw new Error("Location permission was denied")
    })

    setLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt: new Date().toISOString(),
    })
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
    } catch {
      setCameraReady(false)
    }
  }

  function captureSelfie() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setSelfieDataUrl(canvas.toDataURL("image/jpeg", 0.86))
  }

  async function loadSelfieFile(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ""))
      reader.onerror = () => reject(new Error("Failed to read selfie"))
      reader.readAsDataURL(file)
    })
    setSelfieDataUrl(dataUrl)
  }

  async function uploadSelfie(): Promise<string> {
    const blob = blobFromDataUrl(selfieDataUrl)
    const fileName = `attendance-${nextAction}-${Date.now()}.jpg`
    const response = await fetch(`${apiBase}/selfie/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeCode,
        pin,
        action: nextAction,
        fileName,
        contentType: blob.type || "image/jpeg",
        size: blob.size,
      }),
    })
    const presign = await response.json().catch(() => null)
    if (!response.ok) throw new Error(presign?.error ?? "Unable to prepare selfie upload")

    const upload = await fetch(presign.uploadUrl, {
      method: presign.method,
      headers: presign.headers,
      body: blob,
    })
    if (!upload.ok) throw new Error("Selfie upload failed")
    return presign.file.key
  }

  async function submitAttendance() {
    if (!location) {
      setError("Location is required before marking attendance")
      return
    }
    if (!selfieDataUrl) {
      setError("Selfie is required before marking attendance")
      return
    }
    setWorking(true)
    setError(null)
    try {
      const selfieKey = await uploadSelfie()
      const response = await fetch(`${apiBase}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode,
          pin,
          action: nextAction,
          workDate,
          location,
          selfieKey,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "Unable to mark attendance")
      setRecord(body.record)
      setNextAction(body.nextAction ?? "check_in")
      streamRef.current?.getTracks().forEach((track) => track.stop())
      setCameraReady(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark attendance")
    } finally {
      setWorking(false)
    }
  }

  function resetForNextEmployee() {
    setEmployeeCode("")
    setPin("")
    setEmployee(null)
    setRecord(null)
    setLocation(null)
    setSelfieDataUrl("")
    setNextAction("check_in")
    setError(null)
    setCameraReady(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-400">
        <LoaderIcon className="size-6 animate-spin" />
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6">
        <div className="max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <AlertCircleIcon className="mx-auto size-8 text-red-400" />
          <p className="mt-3 text-sm font-medium text-slate-200">{error ?? "Attendance workspace is unavailable"}</p>
        </div>
      </main>
    )
  }

  const accent = workspace.primaryColor || "#f5b400"
  const completed = Boolean(record?.checkInAt && (nextAction === "check_in" || record.checkOutAt))
  const step: "identify" | "capture" | "success" = !employee ? "identify" : completed ? "success" : "capture"
  const errorBox = "rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"

  return (
    <main className="min-h-[100dvh] bg-white text-slate-900">
      <div className="grid min-h-[100dvh] lg:grid-cols-[0.85fr_1.15fr]">
        <section
          className="relative flex flex-col justify-between overflow-hidden p-8 text-slate-300 lg:border-r lg:border-white/5"
          style={{ background: "linear-gradient(160deg, #1e293b 0%, #0b1120 50%, #000000 100%)" }}
        >
          <div className="relative flex items-center">
            {workspace.logoUrl && !logoBroken ? (
              <img
                src={workspace.logoUrl}
                alt={workspace.name}
                onError={() => setLogoBroken(true)}
                className="h-10 w-auto max-w-[14rem] object-contain"
              />
            ) : (
              <h1 className="text-lg font-semibold text-white">{workspace.name}</h1>
            )}
          </div>

          <div className="relative my-12 flex flex-col items-center text-center">
            <p className="text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl">{clockTime}</p>
            <p className="mt-3 text-sm text-slate-400">{clockDate}</p>
          </div>

          <p className="relative max-w-xs text-sm leading-6 text-slate-400">
            Enter your employee code and PIN to clock in or out.
          </p>
        </section>

        <section className="flex items-center justify-center bg-white p-6 py-10 text-slate-900 sm:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full"
            >
              {step === "identify" && (
                <form onSubmit={identify} className="mx-auto w-full max-w-sm">
                  <h2 className="text-2xl font-semibold tracking-tight">Mark attendance</h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Use the employee code and attendance PIN assigned by your administrator.
                  </p>
                  <div className="mt-7 grid gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="employee-code">Employee code</Label>
                      <Input
                        id="employee-code"
                        value={employeeCode}
                        onChange={(event) => setEmployeeCode(event.target.value)}
                        className="h-12 text-base"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="attendance-pin">Attendance PIN</Label>
                      <Input
                        id="attendance-pin"
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(event) => setPin(event.target.value)}
                        className="h-12 text-base tracking-[0.3em]"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {error && <p className={`mt-5 ${errorBox}`}>{error}</p>}
                  <KioskButton className="mt-6 w-full" disabled={working || !employeeCode || !pin}>
                    {working && <LoaderIcon className="size-4 animate-spin" />}
                    Continue
                  </KioskButton>
                  <p className="mt-4 text-center text-xs text-slate-400">
                    Your location and a selfie are captured for verification.
                  </p>
                </form>
              )}

              {step === "success" && employee && (
                <div className="mx-auto w-full max-w-sm text-center">
                  <div
                    className="mx-auto flex size-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${accent}1f` }}
                  >
                    <CheckCircle2Icon className="size-9" style={{ color: accent }} />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                    {record?.checkOutAt ? "Checked out" : "Attendance recorded"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{employee.fullName}, your record has been saved.</p>
                  <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 text-left text-sm">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
                      <span className="text-slate-500">Check in</span>
                      <span className="font-medium tabular-nums">{formatTime(record?.checkInAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-4">
                      <span className="text-slate-500">Check out</span>
                      <span className="font-medium tabular-nums">{formatTime(record?.checkOutAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-4">
                      <span className="text-slate-500">Status</span>
                      <span className="font-medium capitalize">{record?.status?.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                  <KioskButton type="button" className="mt-6 w-full" onClick={resetForNextEmployee}>
                    Next employee
                  </KioskButton>
                </div>
              )}

              {step === "capture" && employee && (
                <div className="mx-auto w-full max-w-md">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Verified employee</p>
                      <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight">{employee.fullName}</h2>
                      <p className="truncate text-sm text-slate-500">{employee.title || employee.employeeCode}</p>
                    </div>
                    <div className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-center text-white">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Next</p>
                      <p className="text-sm font-semibold">{actionLabel(nextAction)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <CameraIcon className="size-4 text-slate-400" />
                        Photo
                      </h3>
                      {selfieDataUrl ? <CapturedBadge /> : <span className="text-xs font-medium text-slate-400">Required</span>}
                    </div>
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200">
                      {selfieDataUrl ? (
                        <img src={selfieDataUrl} alt="Attendance selfie preview" className="h-full w-full object-cover" />
                      ) : (
                        <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {selfieDataUrl ? (
                        <KioskButton type="button" variant="secondary" className="w-full" onClick={() => setSelfieDataUrl("")}>
                          <CameraIcon className="size-4" />
                          Retake
                        </KioskButton>
                      ) : (
                        <KioskButton type="button" className="w-full" onClick={captureSelfie} disabled={!cameraReady}>
                          <CameraIcon className="size-4" />
                          Capture
                        </KioskButton>
                      )}
                      <label className={`${KIOSK_BTN_BASE} ${KIOSK_BTN_SECONDARY} w-full cursor-pointer`}>
                        <UploadIcon className="size-4" />
                        Upload
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          capture="user"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) void loadSelfieFile(file)
                            event.target.value = ""
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                        <MapPinIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Location</p>
                        <p className="truncate text-xs text-slate-500">
                          {location
                            ? `Accuracy ${Math.round(location.accuracy ?? 0)} m`
                            : "Allow access to verify the site."}
                        </p>
                      </div>
                    </div>
                    {location ? (
                      <CapturedBadge />
                    ) : (
                      <KioskButton
                        type="button"
                        variant="secondary"
                        className="shrink-0"
                        onClick={() => void requestLocation().catch((err) => setError(err.message))}
                      >
                        Enable
                      </KioskButton>
                    )}
                  </div>

                  {error && <p className={`mt-4 ${errorBox}`}>{error}</p>}

                  <div className="mt-5 flex gap-3">
                    <KioskButton
                      type="button"
                      className="flex-1"
                      disabled={working || !location || !selfieDataUrl}
                      onClick={() => void submitAttendance()}
                    >
                      {working && <LoaderIcon className="size-4 animate-spin" />}
                      {actionLabel(nextAction)}
                    </KioskButton>
                    <KioskButton type="button" variant="secondary" onClick={resetForNextEmployee}>
                      Cancel
                    </KioskButton>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </main>
  )
}
