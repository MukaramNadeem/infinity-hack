// In-browser fake backend that follows API_CONTRACT.md, so the UI can be built
// and demoed before the real backend exists. Used only when VITE_API_URL is
// empty or VITE_USE_MOCK=true. Data persists in localStorage.
//
// The "AI" here is NOT real: it returns the reference draft from the brief.
// Include the word INVALID in the transcript to get a 422 and test the
// correction screen.

import type { Draft, DraftIssue, ProjectSummary, Task, User } from '../types'

const DB_KEY = 'nw_mock_db'

const USERS: User[] = [
  { id: 'ADMIN', name: 'Admin', email: 'admin@novaworks.example', role: 'ADMIN', specialization: 'Administrator', skills: ['Company overview', 'transcript creation'] },
  { id: 'PM01', name: 'Ayesha Khan', email: 'ayesha@novaworks.example', role: 'MANAGER', specialization: 'Web PM', skills: ['Web projects', 'client coordination'] },
  { id: 'PM02', name: 'Bilal Ahmed', email: 'bilal@novaworks.example', role: 'MANAGER', specialization: 'Mobile PM', skills: ['Mobile projects', 'delivery planning'] },
  { id: 'PM03', name: 'Hina Malik', email: 'hina@novaworks.example', role: 'MANAGER', specialization: 'AI PM', skills: ['AI projects', 'requirement review'] },
  { id: 'DEV01', name: 'Ali Raza', email: 'ali@novaworks.example', role: 'AGENT', specialization: 'Full-Stack', skills: ['React', 'frontend integration'] },
  { id: 'DEV02', name: 'Hamza Shah', email: 'hamza@novaworks.example', role: 'AGENT', specialization: 'Full-Stack', skills: ['Node.js', 'databases', 'APIs'] },
  { id: 'DEV03', name: 'Sara Noor', email: 'sara@novaworks.example', role: 'AGENT', specialization: 'App Developer', skills: ['Flutter', 'mobile UI'] },
  { id: 'DEV04', name: 'Usman Tariq', email: 'usman@novaworks.example', role: 'AGENT', specialization: 'App Developer', skills: ['Flutter', 'integration', 'testing'] },
  { id: 'DEV05', name: 'Zain Abbas', email: 'zain@novaworks.example', role: 'AGENT', specialization: 'AI Developer', skills: ['LLMs', 'extraction', 'prompts'] },
  { id: 'DEV06', name: 'Maryam Asif', email: 'maryam@novaworks.example', role: 'AGENT', specialization: 'AI Developer', skills: ['Retrieval', 'document processing'] },
]
const PASSWORD = 'Demo123!'

const REFERENCE_DRAFT: Draft = {
  projects: [
    {
      name: 'UrbanCart Website', clientName: 'UrbanCart Clothing', managerId: 'PM01', deadline: '2026-10-20',
      description: 'Responsive website to browse products, view product details and add items to a demo cart. No real checkout, payments or inventory integration in this phase.',
      tasks: [
        { title: 'Product catalog UI', description: 'Product listing, product detail screen and responsive layout.', assigneeId: 'DEV01', deadline: '2026-10-12', estimatedHours: 12 },
        { title: 'Demo cart UI', description: 'Add and remove items, quantities and a visible total.', assigneeId: 'DEV01', deadline: '2026-10-15', estimatedHours: 8 },
        { title: 'Product and cart APIs', description: 'Product data responses and demo cart endpoints, no payment processing.', assigneeId: 'DEV02', deadline: '2026-10-14', estimatedHours: 14 },
        { title: 'Website integration and testing', description: 'Connect the screens to the APIs and check the demo flow.', assigneeId: 'DEV01', deadline: '2026-10-19', estimatedHours: 6 },
      ],
    },
    {
      name: 'QuickServe Mobile App', clientName: 'QuickServe Services', managerId: 'PM02', deadline: '2026-10-24',
      description: 'Flutter customer app for signing in, requesting a service and seeing request status. No maps, driver tracking or payments.',
      tasks: [
        { title: 'Login and profile screens', description: 'Customer login interface and a basic profile screen.', assigneeId: 'DEV03', deadline: '2026-10-12', estimatedHours: 8 },
        { title: 'Service booking screens', description: 'Select a service, enter request details and see a confirmation screen.', assigneeId: 'DEV03', deadline: '2026-10-17', estimatedHours: 12 },
        { title: 'Booking and account APIs', description: 'Basic customer account handling, service requests and request status.', assigneeId: 'DEV02', deadline: '2026-10-16', estimatedHours: 16 },
        { title: 'Mobile integration and testing', description: 'Connect mobile UI to the API, show request status and test the full customer flow.', assigneeId: 'DEV04', deadline: '2026-10-22', estimatedHours: 10 },
      ],
    },
    {
      name: 'HelpDeskPro AI Assistant', clientName: 'HelpDeskPro Solutions', managerId: 'PM03', deadline: '2026-10-22',
      description: 'Support assistant that answers from a supplied FAQ and saves unresolved questions for human review. No external messaging.',
      tasks: [
        { title: 'FAQ document processing', description: 'Prepare the supplied FAQ and retrieve relevant content.', assigneeId: 'DEV06', deadline: '2026-10-13', estimatedHours: 10 },
        { title: 'Assistant answer generation', description: 'Use prepared content, connect the model and handle the response structure; say when it cannot resolve a question.', assigneeId: 'DEV05', deadline: '2026-10-17', estimatedHours: 14 },
        { title: 'Human escalation flow', description: 'Save unresolved questions so a person can review them.', assigneeId: 'DEV05', deadline: '2026-10-18', estimatedHours: 6 },
        { title: 'Assistant evaluation and testing', description: 'Test normal questions, missing-answer cases and the escalation path.', assigneeId: 'DEV06', deadline: '2026-10-21', estimatedHours: 8 },
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uid = () => Math.random().toString(36).slice(2, 10)
const ref = (id: string) => ({ id, name: USERS.find((u) => u.id === id)?.name ?? id })
const isDate = (s: unknown) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

function visibleProjects(db: Db, me: User): StoredProject[] {
  if (me.role === 'ADMIN') return db.projects
  if (me.role === 'MANAGER') return db.projects.filter((p) => p.managerId === me.id)
  const ids = new Set(db.tasks.filter((t) => t.assigneeId === me.id).map((t) => t.projectId))
  return db.projects.filter((p) => ids.has(p.id))
}

function visibleTasks(db: Db, me: User, projectId: string): StoredTask[] {
  const tasks = db.tasks.filter((t) => t.projectId === projectId)
  return me.role === 'AGENT' ? tasks.filter((t) => t.assigneeId === me.id) : tasks
}

const toTask = (t: StoredTask): Task => ({
  id: t.id,
  projectId: t.projectId,
  title: t.title,
  description: t.description,
  assignee: ref(t.assigneeId),
  deadline: t.deadline,
  estimatedHours: t.estimatedHours,
})

function toSummary(db: Db, me: User, p: StoredProject): ProjectSummary {
  const tasks = visibleTasks(db, me, p.id)
  return {
    id: p.id,
    name: p.name,
    clientName: p.clientName,
    description: p.description,
    manager: ref(p.managerId),
    deadline: p.deadline,
    taskCount: tasks.length,
    totalHours: tasks.reduce((s, t) => s + t.estimatedHours, 0),
  }
}

function validate(draft: Draft): DraftIssue[] {
  const issues: DraftIssue[] = []
  if (!draft?.projects?.length) return [{ path: 'projects', message: 'No projects found in the transcript.' }]
  draft.projects.forEach((p, i) => {
    const at = `projects[${i}]`
    if (!p.name?.trim()) issues.push({ path: `${at}.name`, message: 'Project name is required.' })
    if (!p.clientName?.trim()) issues.push({ path: `${at}.clientName`, message: 'Client name is required.' })
    if (USERS.find((u) => u.id === p.managerId)?.role !== 'MANAGER')
      issues.push({ path: `${at}.managerId`, message: `"${p.managerId || '(empty)'}" is not an existing manager.` })
    if (!isDate(p.deadline)) issues.push({ path: `${at}.deadline`, message: 'Project deadline must be a valid date.' })
    if (!p.tasks?.length) issues.push({ path: `${at}.tasks`, message: 'Project has no tasks.' })
    p.tasks?.forEach((t, j) => {
      const tat = `${at}.tasks[${j}]`
      if (!t.title?.trim()) issues.push({ path: `${tat}.title`, message: 'Task title is required.' })
      if (USERS.find((u) => u.id === t.assigneeId)?.role !== 'AGENT')
        issues.push({ path: `${tat}.assigneeId`, message: `"${t.assigneeId || '(empty)'}" is not an existing agent.` })
      if (!(Number(t.estimatedHours) > 0))
        issues.push({ path: `${tat}.estimatedHours`, message: 'Estimated hours must be a positive number.' })
      if (!isDate(t.deadline)) issues.push({ path: `${tat}.deadline`, message: 'Task deadline must be a valid date.' })
      else if (isDate(p.deadline) && t.deadline > p.deadline)
        issues.push({ path: `${tat}.deadline`, message: 'Task deadline is after the project deadline.' })
    })
  })
  return issues
}

export async function mockFetch(path: string, init: RequestInit): Promise<Response> {
  await delay(250)
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? JSON.parse(String(init.body)) : {}
  const auth = new Headers(init.headers).get('Authorization') ?? ''
  const me = USERS.find((u) => `Bearer mock-${u.id}` === auth)
  const db = load()

  if (method === 'POST' && path === '/auth/login') {
    const user = USERS.find((u) => u.email.toLowerCase() === String(body.email ?? '').trim().toLowerCase())
    if (!user || body.password !== PASSWORD) return json(401, { error: 'Invalid email or password.' })
    return json(200, { token: `mock-${user.id}`, user })
  }

  if (!me) return json(401, { error: 'Please log in.' })

  if (method === 'GET' && path === '/auth/me') return json(200, me)
  if (method === 'POST' && path === '/auth/logout') return json(204)
  if (method === 'GET' && path === '/users') return json(200, USERS)

  if (method === 'GET' && path === '/projects')
    return json(200, visibleProjects(db, me).map((p) => toSummary(db, me, p)))

  const projectMatch = path.match(/^\/projects\/([^/]+)$/)
  if (method === 'GET' && projectMatch) {
    const id = decodeURIComponent(projectMatch[1])
    const p = visibleProjects(db, me).find((x) => x.id === id)
    if (!p) return json(404, { error: 'Project not found.' })
    return json(200, { ...toSummary(db, me, p), tasks: visibleTasks(db, me, p.id).map(toTask) })
  }

  if (method === 'GET' && path === '/tasks/mine') {
    if (me.role !== 'AGENT') return json(403, { error: 'Only agents have assigned tasks.' })
    const mine = db.tasks
      .filter((t) => t.assigneeId === me.id)
      .map((t) => {
        const p = db.projects.find((x) => x.id === t.projectId)!
        return {
          ...toTask(t),
          project: { id: p.id, name: p.name, clientName: p.clientName, deadline: p.deadline, manager: ref(p.managerId) },
        }
      })
    return json(200, mine)
  }

  if (method === 'POST' && path === '/transcripts') {
    if (me.role !== 'ADMIN') return json(403, { error: 'Only the admin can create projects from a transcript.' })
    let draft: Draft
    if (body.draft) {
      draft = body.draft
    } else {
      const transcript = String(body.transcript ?? '').trim()
      if (!transcript) return json(400, { error: 'Please paste a meeting transcript.' })
      await delay(1500) // pretend the AI is thinking
      draft = structuredClone(REFERENCE_DRAFT)
      if (/INVALID/.test(transcript)) {
        draft.projects[0].managerId = 'Kamran'
        draft.projects[1].tasks[3].deadline = '2026-10-30'
      }
    }
    const issues = validate(draft)
    if (issues.length) return json(422, { error: 'Some details could not be resolved. Nothing was saved.', draft, issues })

    const created: StoredProject[] = []
    for (const p of draft.projects) {
      const project: StoredProject = {
        id: uid(),
        name: p.name.trim(),
        clientName: p.clientName.trim(),
        description: p.description ?? '',
        managerId: p.managerId,
        deadline: p.deadline,
      }
      created.push(project)
      db.projects.push(project)
      for (const t of p.tasks)
        db.tasks.push({
          id: uid(),
          projectId: project.id,
          title: t.title.trim(),
          description: t.description ?? '',
          assigneeId: t.assigneeId,
          deadline: t.deadline,
          estimatedHours: Number(t.estimatedHours),
        })
    }
    save(db)
    const summaries = created.map((p) => toSummary(db, me, p))
    return json(201, {
      projects: summaries,
      projectCount: summaries.length,
      taskCount: summaries.reduce((s, p) => s + p.taskCount, 0),
    })
  }

  return json(404, { error: `No mock route for ${method} ${path}` })
}
