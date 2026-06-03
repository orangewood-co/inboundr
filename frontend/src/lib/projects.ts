const API_ORIGIN = import.meta.env.VITE_API_URL ?? "http://localhost:3000"
const API_BASE = `${API_ORIGIN}/api/v1/projects`

export type ProjectVisibility = "internal" | "private" | "teams"
export type ProjectStatus = "active" | "completed" | "archived"

export interface ProjectEmployee {
  _id: string
  teamId: string | null
  fullName: string
  email: string
  title?: string | null
  profileImageUrl?: string | null
}

export interface ProjectTeam {
  _id: string
  name: string
  description: string | null
}

export interface Project {
  _id: string
  title: string
  description: string | null
  startDate: string | null
  dueDate: string | null
  status: ProjectStatus
  visibility: ProjectVisibility
  visibleTeamIds: string[]
  memberIds: string[]
  managerIds: string[]
  followerIds: string[]
  createdByUserId: string
  archivedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ProjectStage {
  _id: string
  projectId: string
  name: string
  order: number
  color: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectTask {
  _id: string
  projectId: string
  stageId: string
  parentTaskId: string | null
  title: string
  description: string | null
  assigneeIds: string[]
  startDate: string | null
  dueDate: string | null
  estimatedMinutes: number | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface ProjectTimeEntry {
  _id: string
  projectId: string
  taskId: string
  employeeId: string
  minutes: number
  workDate: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectActivity {
  _id: string
  projectId: string
  taskId: string | null
  actorUserId: string | null
  actorEmployeeId: string | null
  type: string
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ProjectDetail {
  project: Project
  stages: ProjectStage[]
  tasks: ProjectTask[]
  timeEntries: ProjectTimeEntry[]
  activities: ProjectActivity[]
}

export interface ProjectReferenceData {
  employees: ProjectEmployee[]
  teams: ProjectTeam[]
}

export interface ProjectListResponse {
  projects: Project[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ProjectPayload {
  title: string
  description?: string | null
  startDate?: string | null
  dueDate?: string | null
  visibility: ProjectVisibility
  visibleTeamIds?: string[]
  memberIds?: string[]
  managerIds?: string[]
  followerIds?: string[]
  status?: ProjectStatus
  metadata?: Record<string, unknown>
}

export interface TaskPayload {
  title: string
  description?: string | null
  stageId: string
  assigneeIds?: string[]
  startDate?: string | null
  dueDate?: string | null
  estimatedMinutes?: number | null
}

export interface TimeEntryPayload {
  employeeId: string
  minutes: number
  workDate: string
  notes?: string | null
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  return data as T
}

export function listProjects(params: { search?: string; status?: string; page?: number; limit?: number }) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 24),
  })
  if (params.search?.trim()) searchParams.set("search", params.search.trim())
  if (params.status && params.status !== "all") searchParams.set("status", params.status)
  return api<ProjectListResponse>(`?${searchParams}`)
}

export function getProjectReferenceData() {
  return api<ProjectReferenceData>("/reference-data")
}

export function getProject(id: string) {
  return api<ProjectDetail>(`/${id}`)
}

export function createProject(payload: ProjectPayload) {
  return api<ProjectDetail>("", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateProject(id: string, payload: Partial<ProjectPayload>) {
  return api<ProjectDetail>(`/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function archiveProject(id: string) {
  return api<{ message: string; project: Project }>(`/${id}/archive`, { method: "PATCH" })
}

export function createProjectStage(projectId: string, payload: { name: string; color?: string | null }) {
  return api<{ stage: ProjectStage }>(`/${projectId}/stages`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateProjectStage(projectId: string, stageId: string, payload: { name?: string; color?: string | null }) {
  return api<{ stage: ProjectStage }>(`/${projectId}/stages/${stageId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function reorderProjectStages(projectId: string, stageIds: string[]) {
  return api<{ message: string }>(`/${projectId}/stages/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ stageIds }),
  })
}

export function archiveProjectStage(projectId: string, stageId: string) {
  return api<{ message: string }>(`/${projectId}/stages/${stageId}/archive`, { method: "PATCH" })
}

export function createProjectTask(projectId: string, payload: TaskPayload) {
  return api<{ task: ProjectTask }>(`/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateProjectTask(projectId: string, taskId: string, payload: Partial<TaskPayload>) {
  return api<{ task: ProjectTask }>(`/${projectId}/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function moveProjectTask(
  projectId: string,
  taskId: string,
  payload: { stageId: string; order: number; startDate?: string | null; dueDate?: string | null }
) {
  return api<{ task: ProjectTask }>(`/${projectId}/tasks/${taskId}/move`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function archiveProjectTask(projectId: string, taskId: string) {
  return api<{ message: string; task: ProjectTask }>(`/${projectId}/tasks/${taskId}/archive`, { method: "PATCH" })
}

export function createProjectSubtask(projectId: string, taskId: string, payload: TaskPayload) {
  return api<{ task: ProjectTask }>(`/${projectId}/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function createProjectTimeEntry(projectId: string, taskId: string, payload: TimeEntryPayload) {
  return api<{ timeEntry: ProjectTimeEntry }>(`/${projectId}/tasks/${taskId}/time-entries`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
