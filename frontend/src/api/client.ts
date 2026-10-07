import type {
  Draft,
  DraftIssue,
  LoginResponse,
  MyTask,
  ProjectDetail,
  ProjectSummary,
  TranscriptResult,
  User,
} from '../types'
import { mockFetch } from './mock'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !API_URL

const TOKEN_KEY = 'nw_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: session lasts until refresh */
  }
}

export class ApiError extends Error {
  status: number
  body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : `Request failed (${status})`)
    this.status = status
    this.body = body
  }
}

// Called on 401 so the app can drop the session and return to login.
let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    const init: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }
    res = USE_MOCK ? await mockFetch(path, init) : await fetch(`${API_URL}/api${path}`, init)
  } catch {
    throw new ApiError(0, { error: 'Cannot reach the server. Is the backend running?' })
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized()
    throw new ApiError(res.status, data)
  }
  return data as T
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { email, password }),
  me: () => request<User>('GET', '/auth/me'),
  logout: () => request<void>('POST', '/auth/logout'),
  users: () => request<User[]>('GET', '/users'),
  projects: () => request<ProjectSummary[]>('GET', '/projects'),
  project: (id: string) => request<ProjectDetail>('GET', `/projects/${encodeURIComponent(id)}`),
  myTasks: () => request<MyTask[]>('GET', '/tasks/mine'),
  fromTranscript: (transcript: string) =>
    request<TranscriptResult>('POST', '/transcripts', { transcript }),
  fromDraft: (draft: Draft) => request<TranscriptResult>('POST', '/transcripts', { draft }),
}

/** Extracts the 422 validation payload so the UI can show issues and an editable draft. */
export function draftErrorOf(err: unknown): { draft: Draft; issues: DraftIssue[] } | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  const { draft, issues } = err.body as { draft?: Draft; issues?: DraftIssue[] }
  if (!draft || !Array.isArray(draft.projects)) return null
  return { draft, issues: Array.isArray(issues) ? issues : [] }
}
