# API Contract (frontend ⇄ backend)

> **Superseded — the frontend now follows the real backend.** The source of truth is the backend's OpenAPI spec:
> `backend/docs/openapi.yaml`, browsable at `http://localhost:4000/api/docs`. `frontend/src/types.ts` and
> `frontend/src/api/client.ts` were updated to it. Differences from the draft below:
>
> - Role `AGENT` is `DEVELOPER`. Users also have a `code` (`ADMIN`, `PM01`…`DEV06`); `id` is a generated id.
> - Responses are wrapped: `{ user }`, `{ users }`, `{ projects }`, `{ project }`, `{ tasks }`.
> - `totalHours` is `totalEstimatedHours`; projects also have `members`; tasks also have `project` and `status`.
> - "My tasks" is `GET /api/tasks` (role-filtered on the server); there is no `/tasks/mine`.
> - Errors are `{ "error": { "code", "message", "details"? } }`.
> - Drafts reference people by code: `managerCode` / `assigneeCode` (fields may be `null`).
>   A 422 returns `{ error: { code: "DRAFT_INVALID", message, details: [{ path, message }] }, draft }` with dot paths
>   such as `projects.2.tasks.1.assigneeCode`. A corrected draft goes to `POST /api/transcripts/commit` as `{ transcript, draft }`.
> - The transcript result is `{ transcriptId, totals: { projects, tasks, estimatedHours }, projects }`.
>
> The original draft contract is kept below for reference.

Agreed shape between the frontend and backend. If the backend needs to change anything here, tell the frontend first.

## Basics
- Base URL: `VITE_API_URL` on the frontend (e.g. `http://localhost:4000`). All routes below are prefixed with `/api`.
- JSON in, JSON out. Dates are `YYYY-MM-DD` strings.
- **Auth:** `POST /api/auth/login` returns a `token`. The frontend sends it on every request as `Authorization: Bearer <token>`. The backend works out the current user from the token only. It never trusts a role or user ID sent in the body or query.
- **CORS:** allow the frontend origin and the `Authorization` + `Content-Type` headers.
- **Errors:** always `{ "error": "Human readable message" }` with the right status:
  `400` bad input · `401` not logged in / bad token · `403` wrong role · `404` not found **or not allowed to see it** · `422` AI draft failed validation · `500/502` server or AI failure.
- **User IDs** are the reference codes from the brief: `ADMIN`, `PM01`–`PM03`, `DEV01`–`DEV06`. Project and task IDs can be any string the backend generates.

## Types
```ts
type Role = "ADMIN" | "MANAGER" | "AGENT";

interface User {            // never include passwordHash
  id: string; name: string; email: string;
  role: Role; specialization: string; skills: string[];
}
interface UserRef { id: string; name: string }

interface Task {
  id: string; projectId: string;
  title: string; description: string;
  assignee: UserRef;
  deadline: string;          // YYYY-MM-DD
  estimatedHours: number;
}
interface ProjectSummary {
  id: string; name: string; clientName: string; description: string;
  manager: UserRef;
  deadline: string;
  taskCount: number;         // count of tasks THIS user can see
  totalHours: number;        // sum of hours of tasks THIS user can see
}
interface ProjectDetail extends ProjectSummary { tasks: Task[] }
interface MyTask extends Task {
  project: { id: string; name: string; clientName: string; deadline: string; manager: UserRef };
}
```

## Endpoints

| Method & path | Who | Request | Success response |
|---|---|---|---|
| `POST /api/auth/login` | anyone | `{ email, password }` | `200 { token, user: User }` · wrong creds → `401` |
| `GET /api/auth/me` | logged in | – | `200 User` |
| `POST /api/auth/logout` | logged in | – | `204` (frontend also drops the token) |
| `GET /api/users` | logged in | – | `200 User[]` (team directory) |
| `GET /api/projects` | logged in | – | `200 ProjectSummary[]` filtered by role (below) |
| `GET /api/projects/:id` | logged in | – | `200 ProjectDetail` · not visible → `404` |
| `GET /api/tasks/mine` | AGENT | – | `200 MyTask[]` |
| `POST /api/transcripts` | ADMIN | `{ transcript }` **or** `{ draft }` | `201 TranscriptResult` · invalid → `422 TranscriptError` |

### Role filtering (enforced on the server for every route)
- `GET /api/projects` returns:
  - ADMIN: all projects
  - MANAGER: projects where `managerId == me`
  - AGENT: distinct projects containing a task assigned to me
- `GET /api/projects/:id` returns `404` if the project isn't in the list above. `tasks` holds:
  - ADMIN: all tasks
  - MANAGER: all tasks (only for projects they manage)
  - AGENT: only tasks assigned to me
- `POST /api/transcripts` returns `403` for anyone except ADMIN.

### Transcript → projects
```ts
// Request: either run the AI on a transcript...
{ "transcript": "full pasted text" }
// ...or re-submit a corrected draft (skips the AI, just validates + saves)
{ "draft": Draft }

interface Draft {            // the AI output shape from the brief
  projects: {
    name: string; clientName: string; description: string;
    managerId: string; deadline: string;
    tasks: { title: string; description: string; assigneeId: string;
             deadline: string; estimatedHours: number }[];
  }[];
}

// 201 Created – everything saved in ONE transaction
interface TranscriptResult {
  projects: ProjectSummary[];
  projectCount: number;
  taskCount: number;
}

// 422 – nothing saved; frontend shows issues and lets admin fix the draft
interface TranscriptError {
  error: string;
  draft: Draft;                                 // what the AI produced
  issues: { path: string; message: string }[];  // e.g. { path: "projects[1].tasks[2].assigneeId", message: "DEV09 is not an agent" }
}
```
Validation per the brief:
- every project has a name, a client, a `managerId` that is an existing MANAGER, and a valid deadline
- every task has a title, an `assigneeId` that is an existing AGENT, `estimatedHours > 0`, and a valid deadline on or before the project deadline

Send the AI the directory (id, name, role, specialization, skills) and **never passwords**.
