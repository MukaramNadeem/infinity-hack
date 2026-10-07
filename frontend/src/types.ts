// Mirrors the backend API: backend/docs/openapi.yaml (interactive docs at /api/docs).
// Keep the two in sync.

export type Role = 'ADMIN' | 'MANAGER' | 'DEVELOPER'

export interface User {
  id: string
  code: string // directory reference: ADMIN, PM01–PM03, DEV01–DEV06
  name: string
  email: string
  role: Role
  specialization: string
  skills: string[]
}

export interface UserRef {
  id: string
  code: string
  name: string
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface Task {
  id: string
  projectId: string
  project: { id: string; name: string; clientName: string }
  title: string
  description: string
  assignee: UserRef
  deadline: string
  estimatedHours: number
  status: TaskStatus
}

export interface ProjectSummary {
  id: string
  name: string
  clientName: string
  description: string
  manager: UserRef
  members: UserRef[]
  deadline: string
  taskCount: number // tasks THIS user can see
  totalEstimatedHours: number // hours of tasks THIS user can see
}

export interface ProjectDetail extends ProjectSummary {
  tasks: Task[]
}

// GET /tasks returns each task with its project, so "my task" is just a Task.
export type MyTask = Task

// AI draft: any field may be null when the AI could not determine it.
// People are referenced by directory code (e.g. PM01, DEV03).
export interface DraftTask {
  title: string | null
  description: string | null
  assigneeCode: string | null
  deadline: string | null
  estimatedHours: number | null
}

export interface DraftProject {
  name: string | null
  clientName: string | null
  description: string | null
  managerCode: string | null
  deadline: string | null
  tasks: DraftTask[]
}

export interface Draft {
  projects: DraftProject[]
}

export interface TranscriptResult {
  transcriptId: string
  totals: { projects: number; tasks: number; estimatedHours: number }
  projects: ProjectDetail[]
}

export interface DraftIssue {
  path: string // dot path, e.g. "projects.2.tasks.1.assigneeCode"
  message: string
}

export interface LoginResponse {
  token: string
  user: User
}
