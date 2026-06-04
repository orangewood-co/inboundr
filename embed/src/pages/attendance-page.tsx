import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  BadgeCheckIcon,
  CameraIcon,
  ClockIcon,
  LoaderIcon,
  LocateFixedIcon,
  ShieldCheckIcon,
  UserRoundIcon,
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
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workDate = useMemo(localWorkDate, [])
  const apiBase = `${API_ORIGIN}/api/v1/public/attendance/${organizationId}`

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
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-amber-100">
        <LoaderIcon className="size-6 animate-spin" />
      </main>
    )
  }

  const completed = Boolean(record?.checkInAt && (nextAction === "check_in" || record.checkOutAt))

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#facc15_0,#facc15_16rem,transparent_16.2rem),linear-gradient(135deg,#111827,#0c0a09_55%,#1c1917)] p-4 text-stone-100 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          <div>
            <div className="flex items-center gap-3">
              {workspace?.logoUrl ? (
                <img src={workspace.logoUrl} alt={`${workspace.name} logo`} className="size-12 rounded-2xl object-contain bg-white p-2" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-300 text-stone-950">
                  <ClockIcon className="size-6" />
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-amber-200/80">Attendance POS</p>
                <h1 className="text-2xl font-black tracking-tight">{workspace?.name ?? "Workspace"}</h1>
              </div>
            </div>
            <div className="mt-10 space-y-4">
              <h2 className="max-w-sm text-5xl font-black leading-none tracking-[-0.06em] sm:text-6xl">
                Mark time at the site.
              </h2>
              <p className="max-w-md text-sm leading-6 text-stone-300">
                Enter your employee code and PIN. This station captures location and a selfie for attendance verification.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-stone-300">
            <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
              <ShieldCheckIcon className="size-5 text-amber-200" />
              PIN verified attendance
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
              <LocateFixedIcon className="size-5 text-amber-200" />
              High accuracy GPS capture
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-black/20 p-3">
              <CameraIcon className="size-5 text-amber-200" />
              Selfie proof for site records
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-stone-50 p-4 text-stone-950 shadow-2xl shadow-black/30 sm:p-6">
          {!employee ? (
            <form onSubmit={identify} className="grid min-h-full content-center gap-5">
              <div>
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-stone-950 text-amber-200">
                  <UserRoundIcon className="size-7" />
                </div>
                <h2 className="text-3xl font-black tracking-tight">Who Is Marking Attendance?</h2>
                <p className="mt-2 text-sm text-stone-500">Use the employee code and attendance PIN assigned by admin.</p>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="employee-code">Employee code</Label>
                  <Input
                    id="employee-code"
                    value={employeeCode}
                    onChange={(event) => setEmployeeCode(event.target.value)}
                    className="h-14 text-2xl font-black tracking-[0.2em]"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="attendance-pin">Attendance PIN</Label>
                  <Input
                    id="attendance-pin"
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    className="h-14 text-2xl font-black tracking-[0.4em]"
                    autoComplete="off"
                  />
                </div>
              </div>
              {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <Button className="h-14 rounded-2xl text-base" disabled={working || !employeeCode || !pin}>
                {working && <LoaderIcon className="size-4 animate-spin" />}
                Continue
              </Button>
            </form>
          ) : completed ? (
            <div className="grid min-h-full content-center gap-6 text-center">
              <BadgeCheckIcon className="mx-auto size-20 text-emerald-500" />
              <div>
                <h2 className="text-4xl font-black tracking-tight">Attendance Marked</h2>
                <p className="mt-2 text-stone-500">{employee.fullName}, your record is saved.</p>
              </div>
              <div className="grid gap-3 rounded-3xl bg-white p-5 text-left shadow-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">Check In</span>
                  <strong>{formatTime(record?.checkInAt)}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">Check Out</span>
                  <strong>{formatTime(record?.checkOutAt)}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">Status</span>
                  <strong className="capitalize">{record?.status?.replace(/_/g, " ")}</strong>
                </div>
              </div>
              <Button type="button" className="h-14 rounded-2xl" onClick={resetForNextEmployee}>
                Next Employee
              </Button>
            </div>
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-stone-500">Verified Employee</p>
                  <h2 className="text-2xl font-black tracking-tight">{employee.fullName}</h2>
                  <p className="text-sm text-stone-500">{employee.title || employee.employeeCode}</p>
                </div>
                <div className="rounded-2xl bg-stone-950 px-5 py-3 text-center text-amber-200">
                  <p className="text-xs uppercase tracking-[0.25em]">Next</p>
                  <p className="text-lg font-black">{actionLabel(nextAction)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold">Location</h3>
                    {location ? <span className="text-xs font-bold text-emerald-600">Captured</span> : <span className="text-xs text-stone-500">Required</span>}
                  </div>
                  <p className="text-sm text-stone-500">
                    {location
                      ? `Accuracy ${Math.round(location.accuracy ?? 0)}m`
                      : "Allow location access so the site can be verified."}
                  </p>
                  <Button type="button" className="mt-4 w-full bg-stone-100 text-stone-950 hover:bg-stone-200" onClick={() => void requestLocation().catch((err) => setError(err.message))}>
                    Refresh Location
                  </Button>
                </div>

                <div className="rounded-3xl border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold">Selfie</h3>
                    {selfieDataUrl ? <span className="text-xs font-bold text-emerald-600">Captured</span> : <span className="text-xs text-stone-500">Required</span>}
                  </div>
                  <div className="aspect-video overflow-hidden rounded-2xl bg-stone-950">
                    {selfieDataUrl ? (
                      <img src={selfieDataUrl} alt="Attendance selfie preview" className="h-full w-full object-cover" />
                    ) : (
                      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="flex-1 bg-stone-950" onClick={captureSelfie} disabled={!cameraReady}>
                      Capture
                    </Button>
                    <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-stone-200">
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

              {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" className="h-14 flex-1 rounded-2xl text-base" disabled={working || !location || !selfieDataUrl} onClick={() => void submitAttendance()}>
                  {working && <LoaderIcon className="size-4 animate-spin" />}
                  {actionLabel(nextAction)}
                </Button>
                <Button type="button" className="h-14 rounded-2xl bg-stone-100 px-6 text-stone-950 hover:bg-stone-200" onClick={resetForNextEmployee}>
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
