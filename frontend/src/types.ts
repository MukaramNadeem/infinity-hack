// Mirrors API_CONTRACT.md at the repo root. Keep the two in sync.

export type Role = 'ADMIN' | 'MANAGER' | 'AGENT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  specialization: string
  skills: string[]
}

export interface UserRef {
  id: string
  name: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  assignee: UserRef
  deadline: string
  estimatedHours: number
}

export interface ProjectSummary {
  id: string
  name: string
  clientName: string
  description: string
  manager: UserRef
  deadline: string
  taskCount: number
  totalHours: number
}

export interface ProjectDetail extends ProjectSummary {
  tasks: Task[]
}

export interface MyTask extends Task {
  project: {
    id: string
    name: string
    clientName: string
    deadline: string
    manager: UserRef
  }
}

export interface DraftTask {
  title: string
  description: string
  assigneeId: string
  deadline: string
  estimatedHours: number
}

export interface DraftProject {
  name: string
  clientName: string
  description: string
  managerId: string
  deadline: string
  tasks: DraftTask[]
}

export interface Draft {
  projects: DraftProject[]
}

export interface TranscriptResult {
  projects: ProjectSummary[]
  projectCount: number
  taskCount: number
}

export interface DraftIssue {
  path: string
  message: string
}

export interface LoginResponse {
  token: string
  user: User
}
