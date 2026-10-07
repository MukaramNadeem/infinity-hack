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

// Backend error body: { error: { code, message, details? }, ...extra } (extra = e.g. `draft` on a 422).
interface ErrorBody {
  error?: string | { code?: string; message?: string; details?: unknown }
  [key: string]: unknown
}

export class ApiError extends Error {
  status: number
  code: string | undefined
  body: ErrorBody
  constructor(status: number, body: ErrorBody) {
    const error = body.error
    const message = typeof error === 'string' ? error : error?.message
    super(message || `Request failed (${status})`)
    this.status = status
    this.code = typeof error === 'object' ? error.code : undefined
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
    // A network failure and a CORS rejection look the same to the browser, so name both causes.
    const message = `Cannot reach the server at ${API_URL}. Is the backend running, and is this page's address (${window.location.origin}) allowed by FRONTEND_URL in backend/.env?`
    throw new ApiError(0, { error: { code: 'NETWORK_ERROR', message } })
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized()
    throw new ApiError(res.status, data)
  }
  return data as T
}

// Endpoints and response shapes: backend/docs/openapi.yaml (served at /api/docs).
// The backend wraps resources ({ user }, { users }, { projects }, …); these helpers unwrap them.
export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User }>('GET', '/auth/me').then((r) => r.user),
  logout: () => request<void>('POST', '/auth/logout'),
  users: () => request<{ users: User[] }>('GET', '/users').then((r) => r.users),
  projects: () => request<{ projects: ProjectSummary[] }>('GET', '/projects').then((r) => r.projects),
  project: (id: string) =>
    request<{ project: ProjectDetail }>('GET', `/projects/${encodeURIComponent(id)}`).then((r) => r.project),
  // Role-scoped on the server: for a developer this is exactly their assigned tasks.
  myTasks: () => request<{ tasks: MyTask[] }>('GET', '/tasks').then((r) => r.tasks),
  // AI extraction + validation + save in one call. 422 = draft needs correction (see draftErrorOf).
  fromTranscript: (transcript: string) =>
    request<TranscriptResult>('POST', '/transcripts', { transcript }),
  // Save an admin-corrected draft (re-validated by the server, no AI call).
  fromDraft: (transcript: string, draft: Draft) =>
    request<TranscriptResult>('POST', '/transcripts/commit', { transcript, draft }),
}

/** Extracts the 422 validation payload so the UI can show issues and an editable draft. */
export function draftErrorOf(err: unknown): { draft: Draft; issues: DraftIssue[] } | null {
  if (!(err instanceof ApiError) || err.status !== 422) return null
  const draft = err.body.draft as Draft | undefined
  const details = typeof err.body.error === 'object' ? err.body.error.details : undefined
  if (!draft || !Array.isArray(draft.projects)) return null
  return { draft, issues: Array.isArray(details) ? (details as DraftIssue[]) : [] }
}
