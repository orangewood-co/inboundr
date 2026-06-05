import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  CameraIcon,
  CheckCircle2Icon,
  ClockIcon,
  LoaderIcon,
  MapPinIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        <LoaderIcon className="size-6 animate-spin" />
      </main>
    )
  }

  const completed = Boolean(record?.checkInAt && (nextAction === "check_in" || record.checkOutAt))

  return (
    <main className="h-screen bg-white text-slate-900">
      <div className="grid h-full overflow-hidden bg-white lg:grid-cols-[0.85fr_1.15fr]">
        <section className="flex flex-col justify-between border-slate-800 bg-slate-900 p-8 text-slate-300 lg:border-r">
          <div className="flex items-center gap-3">
            {workspace?.logoUrl ? (
              <img src={workspace.logoUrl} alt={`${workspace.name} logo`} className="size-11 rounded-lg bg-white object-contain p-1.5" />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-slate-700">
                <ClockIcon className="size-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Attendance Station</p>
              <h1 className="text-lg font-semibold text-white">{workspace?.name ?? "Workspace"}</h1>
            </div>
          </div>

          <div className="my-12 flex flex-col items-center text-center">
            {workspace?.logoUrl ? (
              <img
                src={workspace.logoUrl}
                alt={`${workspace.name} logo`}
                className="mb-8 h-20 max-w-[12rem] rounded-xl bg-white object-contain p-3"
              />
            ) : null}
            <p className="text-6xl font-semibold tabular-nums tracking-tight text-white">{clockTime}</p>
            <p className="mt-3 text-sm text-slate-400">{clockDate}</p>
          </div>

          <p className="max-w-xs text-sm leading-6 text-slate-400">
            Enter your employee code and PIN to clock in or out.
          </p>
        </section>

        <section className="bg-white p-6 text-slate-900 sm:p-10">
          {!employee ? (
            <form onSubmit={identify} className="mx-auto grid min-h-full w-full max-w-sm content-center gap-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Mark attendance</h2>
                <p className="mt-1.5 text-sm text-slate-500">Use the employee code and attendance PIN assigned by your administrator.</p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="employee-code">Employee code</Label>
                  <Input
                    id="employee-code"
                    value={employeeCode}
                    onChange={(event) => setEmployeeCode(event.target.value)}
                    className="h-12 text-lg tracking-wide"
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
                    className="h-12 text-lg tracking-[0.3em]"
                    autoComplete="off"
                  />
                </div>
              </div>
              {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button className="h-12 text-sm" disabled={working || !employeeCode || !pin}>
                {working && <LoaderIcon className="size-4 animate-spin" />}
                Continue
              </Button>
            </form>
          ) : completed ? (
            <div className="mx-auto grid min-h-full w-full max-w-sm content-center gap-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2Icon className="size-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Attendance recorded</h2>
                  <p className="mt-1 text-sm text-slate-500">{employee.fullName}, your record has been saved.</p>
                </div>
              </div>
              <div className="grid gap-3 rounded-lg border border-slate-200 p-5 text-left text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Check in</span>
                  <span className="font-medium tabular-nums">{formatTime(record?.checkInAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                  <span className="text-slate-500">Check out</span>
                  <span className="font-medium tabular-nums">{formatTime(record?.checkOutAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium capitalize">{record?.status?.replace(/_/g, " ")}</span>
                </div>
              </div>
              <Button type="button" className="h-12" onClick={resetForNextEmployee}>
                Next employee
              </Button>
            </div>
          ) : (
            <div className="grid min-h-full content-center gap-5">
              <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Verified employee</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">{employee.fullName}</h2>
                  <p className="text-sm text-slate-500">{employee.title || employee.employeeCode}</p>
                </div>
                <div className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-center text-white">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Next action</p>
                  <p className="text-sm font-semibold">{actionLabel(nextAction)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <MapPinIcon className="size-4 text-slate-400" />
                      Location
                    </h3>
                    {location ? (
                      <span className="text-xs font-medium text-emerald-600">Captured</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Required</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {location
                      ? `Accuracy ${Math.round(location.accuracy ?? 0)} m`
                      : "Allow location access so the site can be verified."}
                  </p>
                  <Button type="button" className="mt-4 w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => void requestLocation().catch((err) => setError(err.message))}>
                    Refresh location
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <CameraIcon className="size-4 text-slate-400" />
                      Photo
                    </h3>
                    {selfieDataUrl ? (
                      <span className="text-xs font-medium text-emerald-600">Captured</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">Required</span>
                    )}
                  </div>
                  <div className="aspect-video overflow-hidden rounded-md bg-slate-900">
                    {selfieDataUrl ? (
                      <img src={selfieDataUrl} alt="Attendance selfie preview" className="h-full w-full object-cover" />
                    ) : (
                      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="flex-1" onClick={captureSelfie} disabled={!cameraReady}>
                      Capture
                    </Button>
                    <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
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
              </div>

              {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" className="h-12 flex-1 text-sm" disabled={working || !location || !selfieDataUrl} onClick={() => void submitAttendance()}>
                  {working && <LoaderIcon className="size-4 animate-spin" />}
                  {actionLabel(nextAction)}
                </Button>
                <Button type="button" className="h-12 border border-slate-200 bg-white px-6 text-slate-700 hover:bg-slate-50" onClick={resetForNextEmployee}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
