// In-browser fake backend that returns the same shapes as the real backend
// (backend/docs/openapi.yaml), so the UI can be demoed without running it.
// Used only when VITE_API_URL is empty or VITE_USE_MOCK=true. Data persists in localStorage.
//
// The "AI" here is NOT real: it returns the reference draft from the brief.
// Include the word INVALID in the transcript to get a 422 and test the
// correction screen.

import type { Draft, DraftIssue, ProjectSummary, Task, User } from '../types'

const DB_KEY = 'nw_mock_db_v2' // v2: backend-shaped data (draft codes, statuses)

// Mock user ids equal their directory codes; the real backend uses generated ids.
const USERS: User[] = [
  { id: 'ADMIN', code: 'ADMIN', name: 'Admin', email: 'admin@novaworks.example', role: 'ADMIN', specialization: 'Administrator', skills: ['Company overview', 'Transcript creation'] },
  { id: 'PM01', code: 'PM01', name: 'Ayesha Khan', email: 'ayesha@novaworks.example', role: 'MANAGER', specialization: 'Web PM', skills: ['Web projects', 'Client coordination'] },
  { id: 'PM02', code: 'PM02', name: 'Bilal Ahmed', email: 'bilal@novaworks.example', role: 'MANAGER', specialization: 'Mobile PM', skills: ['Mobile projects', 'Delivery planning'] },
  { id: 'PM03', code: 'PM03', name: 'Hina Malik', email: 'hina@novaworks.example', role: 'MANAGER', specialization: 'AI PM', skills: ['AI projects', 'Requirement review'] },
  { id: 'DEV01', code: 'DEV01', name: 'Ali Raza', email: 'ali@novaworks.example', role: 'DEVELOPER', specialization: 'Full-Stack', skills: ['React', 'Frontend integration'] },
  { id: 'DEV02', code: 'DEV02', name: 'Hamza Shah', email: 'hamza@novaworks.example', role: 'DEVELOPER', specialization: 'Full-Stack', skills: ['Node.js', 'Databases', 'APIs'] },
  { id: 'DEV03', code: 'DEV03', name: 'Sara Noor', email: 'sara@novaworks.example', role: 'DEVELOPER', specialization: 'App Developer', skills: ['Flutter', 'Mobile UI'] },
  { id: 'DEV04', code: 'DEV04', name: 'Usman Tariq', email: 'usman@novaworks.example', role: 'DEVELOPER', specialization: 'App Developer', skills: ['Flutter', 'Integration', 'Testing'] },
  { id: 'DEV05', code: 'DEV05', name: 'Zain Abbas', email: 'zain@novaworks.example', role: 'DEVELOPER', specialization: 'AI Developer', skills: ['LLMs', 'Extraction', 'Prompts'] },
  { id: 'DEV06', code: 'DEV06', name: 'Maryam Asif', email: 'maryam@novaworks.example', role: 'DEVELOPER', specialization: 'AI Developer', skills: ['Retrieval', 'Document processing'] },
]
const PASSWORD = 'Demo123!'

const REFERENCE_DRAFT: Draft = {
  projects: [
    {
      name: 'UrbanCart Website', clientName: 'UrbanCart Clothing', managerCode: 'PM01', deadline: '2026-10-20',
      description: 'Responsive website to browse products, view product details and add items to a demo cart. No real checkout, payments or inventory integration in this phase.',
      tasks: [
        { title: 'Product catalog UI', description: 'Product listing, product detail screen and responsive layout.', assigneeCode: 'DEV01', deadline: '2026-10-12', estimatedHours: 12 },
        { title: 'Demo cart UI', description: 'Add and remove items, quantities and a visible total.', assigneeCode: 'DEV01', deadline: '2026-10-15', estimatedHours: 8 },
        { title: 'Product and cart APIs', description: 'Product data responses and demo cart endpoints, no payment processing.', assigneeCode: 'DEV02', deadline: '2026-10-14', estimatedHours: 14 },
        { title: 'Website integration and testing', description: 'Connect the screens to the APIs and check the demo flow.', assigneeCode: 'DEV01', deadline: '2026-10-19', estimatedHours: 6 },
      ],
    },
    {
      name: 'QuickServe Mobile App', clientName: 'QuickServe Services', managerCode: 'PM02', deadline: '2026-10-24',
      description: 'Flutter customer app for signing in, requesting a service and seeing request status. No maps, driver tracking or payments.',
      tasks: [
        { title: 'Login and profile screens', description: 'Customer login interface and a basic profile screen.', assigneeCode: 'DEV03', deadline: '2026-10-12', estimatedHours: 8 },
        { title: 'Service booking screens', description: 'Select a service, enter request details and see a confirmation screen.', assigneeCode: 'DEV03', deadline: '2026-10-17', estimatedHours: 12 },
        { title: 'Booking and account APIs', description: 'Basic customer account handling, service requests and request status.', assigneeCode: 'DEV02', deadline: '2026-10-16', estimatedHours: 16 },
        { title: 'Mobile integration and testing', description: 'Connect mobile UI to the API, show request status and test the full customer flow.', assigneeCode: 'DEV04', deadline: '2026-10-22', estimatedHours: 10 },
      ],
    },
    {
      name: 'HelpDeskPro AI Assistant', clientName: 'HelpDeskPro Solutions', managerCode: 'PM03', deadline: '2026-10-22',
      description: 'Support assistant that answers from a supplied FAQ and saves unresolved questions for human review. No external messaging.',
      tasks: [
        { title: 'FAQ document processing', description: 'Prepare the supplied FAQ and retrieve relevant content.', assigneeCode: 'DEV06', deadline: '2026-10-13', estimatedHours: 10 },
        { title: 'Assistant answer generation', description: 'Use prepared content, connect the model and handle the response structure; say when it cannot resolve a question.', assigneeCode: 'DEV05', deadline: '2026-10-17', estimatedHours: 14 },
        { title: 'Human escalation flow', description: 'Save unresolved questions so a person can review them.', assigneeCode: 'DEV05', deadline: '2026-10-18', estimatedHours: 6 },
        { title: 'Assistant evaluation and testing', description: 'Test normal questions, missing-answer cases and the escalation path.', assigneeCode: 'DEV06', deadline: '2026-10-21', estimatedHours: 8 },
      ],
    },
  ],
}

interface StoredProject {
  id: string
  name: string
  clientName: string
  description: string
  managerId: string
  deadline: string
}
interface StoredTask {
  id: string
  projectId: string
  title: string
  description: string
  assigneeId: string
  deadline: string
  estimatedHours: number
  status: Task['status']
}
interface Db {
  projects: StoredProject[]
  tasks: StoredTask[]
}

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    /* fall through */
  }
  return { projects: [], tasks: [] }
}

function save(db: Db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* in-memory only */
  }
}

/** Dev helper: wipe generated projects/tasks (users are hardcoded). */
export function resetMockDb() {
  save({ projects: [], tasks: [] })
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
// Backend error envelope: { error: { code, message, details? }, ...extra }
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { error: { code, message, ...(extra.details !== undefined && { details: extra.details }) }, ...(extra.draft !== undefined && { draft: extra.draft }) })

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uid = () => Math.random().toString(36).slice(2, 10)
const ref = (id: string) => {
  const u = USERS.find((x) => x.id === id)
  return { id, code: u?.code ?? id, name: u?.name ?? id }
}
const byCode = (code: string | null) => USERS.find((u) => u.code.toLowerCase() === String(code ?? '').toLowerCase())
const isDate = (s: unknown) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

function visibleProjects(db: Db, me: User): StoredProject[] {
  if (me.role === 'ADMIN') return db.projects
  if (me.role === 'MANAGER') return db.projects.filter((p) => p.managerId === me.id)
  const ids = new Set(db.tasks.filter((t) => t.assigneeId === me.id).map((t) => t.projectId))
  return db.projects.filter((p) => ids.has(p.id))
}

function visibleTasks(db: Db, me: User, projectId?: string): StoredTask[] {
  const scoped = visibleProjects(db, me).map((p) => p.id)
  const tasks = db.tasks.filter((t) => scoped.includes(t.projectId) && (!projectId || t.projectId === projectId))
  return me.role === 'DEVELOPER' ? tasks.filter((t) => t.assigneeId === me.id) : tasks
}

function toTask(db: Db, t: StoredTask): Task {
  const p = db.projects.find((x) => x.id === t.projectId)!
  return {
    id: t.id,
    projectId: t.projectId,
    project: { id: p.id, name: p.name, clientName: p.clientName },
    title: t.title,
    description: t.description,
    assignee: ref(t.assigneeId),
    deadline: t.deadline,
    estimatedHours: t.estimatedHours,
    status: t.status,
  }
}

function toSummary(db: Db, me: User, p: StoredProject): ProjectSummary {
  const tasks = visibleTasks(db, me, p.id)
  return {
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    description: p.description,
    manager: ref(p.managerId),
    members: [...new Set(tasks.map((t) => t.assigneeId))].sort().map(ref),
    deadline: p.deadline,
    taskCount: tasks.length,
    totalEstimatedHours: tasks.reduce((s, t) => s + t.estimatedHours, 0),
  }
}

const toDetail = (db: Db, me: User, p: StoredProject) => ({
  ...toSummary(db, me, p),
  tasks: visibleTasks(db, me, p.id).map((t) => toTask(db, t)),
})

// Same rules and dot paths as the backend (e.g. "projects.0.tasks.2.assigneeCode").
function validate(draft: Draft): DraftIssue[] {
  const issues: DraftIssue[] = []
  if (!draft?.projects?.length) return [{ path: 'projects', message: 'No projects were found in the transcript' }]
  draft.projects.forEach((p, i) => {
    const at = `projects.${i}`
    if (!p.name?.trim()) issues.push({ path: `${at}.name`, message: 'Project name is missing.' })
    if (!p.clientName?.trim()) issues.push({ path: `${at}.clientName`, message: 'Client name is missing.' })
    if (byCode(p.managerCode)?.role !== 'MANAGER')
      issues.push({ path: `${at}.managerCode`, message: `"${p.managerCode || '(empty)'}" is not a manager in the team directory.` })
    if (!isDate(p.deadline)) issues.push({ path: `${at}.deadline`, message: 'Project deadline must be a valid date.' })
    p.tasks?.forEach((t, j) => {
      const tat = `${at}.tasks.${j}`
      if (!t.title?.trim()) issues.push({ path: `${tat}.title`, message: 'Task title is missing.' })
      if (byCode(t.assigneeCode)?.role !== 'DEVELOPER')
        issues.push({ path: `${tat}.assigneeCode`, message: `"${t.assigneeCode || '(empty)'}" is not a developer in the team directory.` })
      if (!(Number(t.estimatedHours) > 0))
        issues.push({ path: `${tat}.estimatedHours`, message: 'Estimated hours must be greater than 0.' })
      if (!isDate(t.deadline)) issues.push({ path: `${tat}.deadline`, message: 'Task deadline must be a valid date.' })
      else if (isDate(p.deadline) && t.deadline! > p.deadline!)
        issues.push({ path: `${tat}.deadline`, message: 'Task deadline is after the project deadline.' })
    })
  })
  return issues
}

function saveDraft(db: Db, me: User, draft: Draft) {
  const created: StoredProject[] = []
  for (const p of draft.projects) {
    const project: StoredProject = {
      id: uid(),
      name: p.name!.trim(),
      clientName: p.clientName!.trim(),
      description: p.description ?? '',
      managerId: byCode(p.managerCode)!.id,
      deadline: p.deadline!,
    }
    created.push(project)
    db.projects.push(project)
    for (const t of p.tasks)
      db.tasks.push({
        id: uid(),
        projectId: project.id,
        title: t.title!.trim(),
        description: t.description ?? '',
        assigneeId: byCode(t.assigneeCode)!.id,
        deadline: t.deadline!,
        estimatedHours: Number(t.estimatedHours),
        status: 'TODO',
      })
  }
  save(db)
  const projects = created.map((p) => toDetail(db, me, p))
  return {
    transcriptId: uid(),
    totals: {
      projects: projects.length,
      tasks: projects.reduce((s, p) => s + p.taskCount, 0),
      estimatedHours: projects.reduce((s, p) => s + p.totalEstimatedHours, 0),
    },
    projects,
  }
}

export async function mockFetch(path: string, init: RequestInit): Promise<Response> {
  await delay(250)
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? JSON.parse(String(init.body)) : {}
  const auth = new Headers(init.headers).get('Authorization') ?? ''
  const me = USERS.find((u) => `Bearer mock-${u.id}` === auth)
  const db = load()
  const [route] = path.split('?')

  if (method === 'POST' && route === '/auth/login') {
    const user = USERS.find((u) => u.email.toLowerCase() === String(body.email ?? '').trim().toLowerCase())
    if (!user || body.password !== PASSWORD) return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    return json(200, { token: `mock-${user.id}`, user })
  }

  if (!me) return fail(401, 'UNAUTHORIZED', 'Authentication required')

  if (method === 'GET' && route === '/auth/me') return json(200, { user: me })
  if (method === 'POST' && route === '/auth/logout') return json(204)
  if (method === 'GET' && route === '/users') return json(200, { users: USERS })

  if (method === 'GET' && route === '/projects')
    return json(200, { projects: visibleProjects(db, me).map((p) => toSummary(db, me, p)) })

  const projectMatch = route.match(/^\/projects\/([^/]+)$/)
  if (method === 'GET' && projectMatch) {
    const id = decodeURIComponent(projectMatch[1])
    const p = visibleProjects(db, me).find((x) => x.id === id)
    if (!p) return fail(404, 'NOT_FOUND', 'Project not found')
    return json(200, { project: toDetail(db, me, p) })
  }

  if (method === 'GET' && route === '/tasks')
    return json(200, { tasks: visibleTasks(db, me).map((t) => toTask(db, t)) })

  if (method === 'POST' && (route === '/transcripts' || route === '/transcripts/commit')) {
    if (me.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'This action requires role: ADMIN')
    const transcript = String(body.transcript ?? '').trim()
    if (transcript.length < 20) return fail(400, 'VALIDATION_ERROR', 'Request validation failed', { details: [{ path: 'transcript', message: 'Transcript is empty or too short' }] })

    let draft: Draft
    if (route === '/transcripts/commit') {
      draft = body.draft
    } else {
      await delay(1500) // pretend the AI is thinking
      draft = structuredClone(REFERENCE_DRAFT)
      if (/INVALID/.test(transcript)) {
        draft.projects[0].managerCode = 'Kamran'
        draft.projects[1].tasks[3].deadline = '2026-10-30'
      }
    }
    const issues = validate(draft)
    if (issues.length)
      return fail(422, 'DRAFT_INVALID', 'Some required information could not be resolved. Correct the draft and save again. Nothing was saved.', { details: issues, draft })
    return json(201, saveDraft(db, me, draft))
  }

  return fail(404, 'NOT_FOUND', `No mock route for ${method} ${route}`)
}
