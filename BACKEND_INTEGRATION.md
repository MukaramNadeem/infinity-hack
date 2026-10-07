# Backend Integration Guide

**Audience:** the backend developer, or a coding agent, building the NovaWorks CRM API.

**Goal:** make the backend plug into the existing frontend in `frontend/` with **zero frontend code changes**.

The frontend is finished and currently runs against an in-browser fake backend (`frontend/src/api/mock.ts`). It switches to your backend as soon as `VITE_API_URL` points at it. Everything below is what the frontend expects. Follow it exactly.

Read these files first:
- `API_CONTRACT.md`: the request and response shapes (this guide expands on it).
- `frontend/src/types.ts`: the exact TypeScript types the frontend reads.
- `frontend/src/api/mock.ts`: a **working reference implementation** of every rule below (access filtering, validation, response shapes). If in doubt, behave like the mock.
- `frontend/public/sample-transcript.txt`: the supplied meeting transcript for testing.
- `Infinity_Hack_26_AI_Project_Manager_Challenge (1).pdf`: the challenge brief.

---

## 0. Non-negotiables (judges check these)

1. **Role-based access is enforced on the server**, for every request. The current user comes **only** from the auth token, never from a role or user ID in the body, query or URL.
2. **Only the ADMIN** can create projects from a transcript.
3. **Passwords are hashed** (bcrypt/argon2) and are **never sent to the AI** or returned in any response.
4. **All-or-nothing save:** the projects and tasks from one transcript are saved in a single DB transaction. If the AI fails or the draft is invalid, nothing is saved.
5. **The output must come from a real AI call.** A changed transcript must produce changed records. No hardcoded answer.
6. **The seed script is idempotent:** it upserts by email, and re-running it never duplicates users.
7. **Data persists across restarts** (a real database: Postgres, SQLite or MySQL).

---

## 1. General API conventions

| Item | Requirement |
|---|---|
| Base path | Every route is under **`/api`** (the frontend calls `${VITE_API_URL}/api/...`) |
| Format | JSON request and response bodies; `Content-Type: application/json` |
| Dates | Always strings `YYYY-MM-DD`, e.g. `"2026-10-20"`. Never return ISO timestamps or Date objects for `deadline`. |
| IDs | **User IDs are the reference codes** `ADMIN`, `PM01`–`PM03`, `DEV01`–`DEV06`. Project and task IDs can be any string (uuid/cuid). If your DB uses integer IDs, return them **as strings**. |
| Numbers | `estimatedHours` is a JSON number (not a string). |
| Errors | Every non-2xx response has the body **`{ "error": "Human readable message" }`**. The frontend shows this text to the user, so make it readable. |
| Auth header | `Authorization: Bearer <token>` |
| CORS | Allow the frontend origin (dev: `http://localhost:5173`), methods `GET, POST, OPTIONS`, and headers `Authorization, Content-Type`. Credentials/cookies are **not** used. |

### Status codes the frontend reacts to

| Status | When | Frontend behavior |
|---|---|---|
| `200` / `201` | success | renders data |
| `204` | logout | nothing |
| `400` | bad input (e.g. empty transcript) | shows `error` |
| `401` | missing, invalid or expired token; wrong login | logs the user out (except on login, where it shows "invalid credentials") |
| `403` | logged in but wrong role (e.g. agent calls `/transcripts`) | shows `error` |
| `404` | resource doesn't exist **or the user isn't allowed to see it** | shows "not found" |
| `422` | AI draft failed validation (special body, see §6) | opens the correction editor |
| `500` / `502` | server or AI failure | shows `error` |

> Use **404 rather than 403** when a user requests a project outside their scope. Don't reveal that it exists.

---

## 2. Data model

```
User {
  id              string  PK          -- "ADMIN", "PM01", "DEV01", …
  name            string  required
  email           string  required unique (store lowercase)
  passwordHash    string  required
  role            enum    ADMIN | MANAGER | AGENT
  specialization  string
  skills          string[]            -- Postgres text[] or JSON column
}
Project {
  id          string  PK (generated)
  name        string  required
  clientName  string  required
  description string
  managerId   string  FK -> User.id   (must be a MANAGER)
  deadline    date / 'YYYY-MM-DD'
  createdAt   timestamp (optional, useful for ordering)
}
Task {
  id              string  PK (generated)
  projectId       string  FK -> Project.id  ON DELETE CASCADE
  title           string  required
  description     string
  assigneeId      string  FK -> User.id      (must be an AGENT)
  deadline        date / 'YYYY-MM-DD'
  estimatedHours  number  > 0
}
```

No cost, rate, progress or status fields are needed.

> If you store `deadline` as a SQL `DATE`, serialize it back to `YYYY-MM-DD` yourself. Many drivers return a JS `Date` at UTC midnight, which can shift by a day in Asia/Karachi. Storing it as text (`'2026-10-20'`) is simplest.

---

## 3. Seed script (10 demo users)

Upsert by email and hash `Demo123!`. Re-running must not create duplicates.

| id | name | email | role | specialization | skills |
|---|---|---|---|---|---|
| ADMIN | Admin | admin@novaworks.example | ADMIN | Administrator | Company overview, transcript creation |
| PM01 | Ayesha Khan | ayesha@novaworks.example | MANAGER | Web PM | Web projects, client coordination |
| PM02 | Bilal Ahmed | bilal@novaworks.example | MANAGER | Mobile PM | Mobile projects, delivery planning |
| PM03 | Hina Malik | hina@novaworks.example | MANAGER | AI PM | AI projects, requirement review |
| DEV01 | Ali Raza | ali@novaworks.example | AGENT | Full-Stack | React, frontend integration |
| DEV02 | Hamza Shah | hamza@novaworks.example | AGENT | Full-Stack | Node.js, databases, APIs |
| DEV03 | Sara Noor | sara@novaworks.example | AGENT | App Developer | Flutter, mobile UI |
| DEV04 | Usman Tariq | usman@novaworks.example | AGENT | App Developer | Flutter, integration, testing |
| DEV05 | Zain Abbas | zain@novaworks.example | AGENT | AI Developer | LLMs, extraction, prompts |
| DEV06 | Maryam Asif | maryam@novaworks.example | AGENT | AI Developer | Retrieval, document processing |

Password for all accounts: `Demo123!`

Also provide a **reset command** that deletes all projects and tasks but keeps the users, for re-testing the transcript flow.

---

## 4. Authentication

- `POST /api/auth/login`: look up the user by email (case-insensitive) and verify the password hash.
  - Success: `200 { token, user }`.
  - Failure: `401 { error: "Invalid email or password." }`. Use the same message for an unknown email and a wrong password.
- The token can be a **JWT** signed with `JWT_SECRET` (payload `{ sub: user.id }`, e.g. 12h expiry) or an opaque session ID stored in the DB. The frontend treats it as an opaque string.
- **Auth middleware** for every route except login:
  1. Read `Authorization: Bearer <token>`. Missing or invalid → `401 { error: "Please log in." }`.
  2. Load the user from the DB by token subject → attach it as `req.user`. User not found → `401`.
- `GET /api/auth/me` → `200 User`. The frontend calls this on page refresh to restore the session.
- `POST /api/auth/logout` → `204`. With JWT, doing nothing is fine; the frontend deletes its copy.

**Never** include `passwordHash` in any response. Map users through a `toPublicUser()` helper.

---

## 5. Read endpoints and access rules

Response types (identical to `frontend/src/types.ts`):

```ts
User           { id, name, email, role, specialization, skills: string[] }
UserRef        { id, name }
Task           { id, projectId, title, description, assignee: UserRef, deadline, estimatedHours }
ProjectSummary { id, name, clientName, description, manager: UserRef, deadline, taskCount, totalHours }
ProjectDetail  = ProjectSummary & { tasks: Task[] }
MyTask         = Task & { project: { id, name, clientName, deadline, manager: UserRef } }
```

Note: responses use **`manager: {id, name}`** and **`assignee: {id, name}`**, not bare `managerId`/`assigneeId`. Join the user name in.

### Visibility helpers (implement once, reuse everywhere)

```
visibleProjects(me):
  ADMIN   -> all projects
  MANAGER -> projects WHERE managerId = me.id
  AGENT   -> DISTINCT projects that have ≥1 task WHERE assigneeId = me.id

visibleTasks(me, projectId):        -- call only after the project is visible
  ADMIN   -> all tasks in project
  MANAGER -> all tasks in project
  AGENT   -> tasks in project WHERE assigneeId = me.id
```

`taskCount` and `totalHours` in a `ProjectSummary` are computed from **`visibleTasks(me, project)`**. An agent's card therefore shows only their own task count and hours.

### Endpoints

| Route | Who | Behavior |
|---|---|---|
| `GET /api/users` | any logged-in user | `200 User[]`: the whole directory (read-only team page) |
| `GET /api/projects` | any logged-in user | `200 ProjectSummary[]` from `visibleProjects(me)`, sorted by deadline or creation |
| `GET /api/projects/:id` | any logged-in user | if `id` is not in `visibleProjects(me)` → `404 { error: "Project not found." }`; else `200 ProjectDetail` with `tasks = visibleTasks(me, id)` |
| `GET /api/tasks/mine` | AGENT | `200 MyTask[]`: all tasks where `assigneeId = me.id`, each with its parent project info. Non-agents → `403`. |

Agents may see the project name, client and manager for their projects, but **never another agent's tasks**.

---

## 6. `POST /api/transcripts`: the AI flow

**ADMIN only** (others → `403 { error: "Only the admin can create projects from a transcript." }`).

The request body is **one of**:

```jsonc
{ "transcript": "full pasted meeting text" }   // run the AI, then validate + save
{ "draft": { "projects": [ … ] } }             // admin's corrected draft: skip the AI, validate + save
```

### Step-by-step

```
1. if body.draft is present:
       draft = body.draft
   else:
       transcript = body.transcript?.trim()
       if empty -> 400 { error: "Please paste a meeting transcript." }
       directory = all users -> [{ id, name, role, specialization, skills }]   (NO email/password needed)
       draft = callAI(transcript, directory)
       if the AI call fails / times out -> 502 { error: "AI service failed, please try again." }
       if the output is not parseable JSON -> 502 { error: "AI returned an unreadable result, please try again." }
2. issues = validate(draft)
3. if issues not empty -> 422 { error, draft, issues }        (save NOTHING)
4. BEGIN TRANSACTION
     for each project: insert Project (generate id)
       for each task: insert Task (generate id, projectId = new project id)
   COMMIT   (on any error ROLLBACK -> 500)
5. 201 { projects: ProjectSummary[] (the newly created ones), projectCount, taskCount }
```

### AI output shape (the draft)

```json
{
  "projects": [
    {
      "name": "UrbanCart Website",
      "clientName": "UrbanCart Clothing",
      "description": "…scope, including what is excluded…",
      "managerId": "PM01",
      "deadline": "2026-10-20",
      "tasks": [
        {
          "title": "Product catalog UI",
          "description": "…",
          "assigneeId": "DEV01",
          "deadline": "2026-10-12",
          "estimatedHours": 12
        }
      ]
    }
  ]
}
```

### Validation rules → `issues`

Each issue is `{ "path": string, "message": string }`. **The `path` format matters:** the frontend uses it to highlight the exact field. Use these paths:

| Check | path |
|---|---|
| no projects at all | `projects` |
| project name missing | `projects[i].name` |
| client missing | `projects[i].clientName` |
| managerId isn't an existing MANAGER | `projects[i].managerId` |
| project deadline isn't a valid `YYYY-MM-DD` | `projects[i].deadline` |
| project has no tasks | `projects[i].tasks` |
| task title missing | `projects[i].tasks[j].title` |
| assigneeId isn't an existing AGENT | `projects[i].tasks[j].assigneeId` |
| task deadline invalid **or after the project deadline** | `projects[i].tasks[j].deadline` |
| estimatedHours not a positive number | `projects[i].tasks[j].estimatedHours` |

`i` and `j` are 0-based indexes. Example 422 body:

```json
{
  "error": "Some details could not be resolved. Nothing was saved.",
  "draft": { "projects": [ … exactly what the AI returned … ] },
  "issues": [
    { "path": "projects[0].managerId", "message": "\"Kamran\" is not an existing manager." },
    { "path": "projects[1].tasks[3].deadline", "message": "Task deadline is after the project deadline." }
  ]
}
```

The frontend shows these issues, lets the admin fix the fields (managers and agents are picked from dropdowns), then re-sends `{ draft }` to the same endpoint.

Also: normalize before validating (trim strings, coerce `estimatedHours` with `Number()`). Reject unknown IDs; **never create new users** from the transcript.

### AI call guidance

- Keep the API key server-side only (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`). Never expose it to the frontend.
- Use **structured output / JSON mode / a tool schema** so the response is guaranteed JSON. Otherwise strip any text around the JSON before calling `JSON.parse`.
- Set temperature to 0 or low, and allow enough max tokens (about 4k) for 3 projects × 4 tasks.
- Prompt essentials (system prompt):
  - "You convert a meeting transcript into projects and tasks for NovaWorks Technologies. Today is 2026-10-07; all dates are in 2026; output dates as YYYY-MM-DD."
  - "Use ONLY people from this directory, referenced by `id`. Managers (role MANAGER) manage projects; tasks are assigned to agents (role AGENT). Never invent people. People mentioned who are not in the directory (e.g. client contacts) must not be assigned anything."
  - "When the meeting revises a decision (deadline, hours or owner), use the **final agreed** value; prefer the final recap."
  - "Exclude features the meeting explicitly rejected or deferred. Do not create tasks for them."
  - "Keep tasks the meeting asked to keep separate as separate tasks; do not split tasks the meeting said to keep as one."
  - "estimatedHours is developer effort in hours, not calendar days."
  - "Project description should state the agreed scope and notable exclusions."
  - "Return only JSON matching the schema."
  - Then the directory as JSON, then the transcript.

---

## 7. Expected result for the supplied transcript (acceptance test)

POSTing `frontend/public/sample-transcript.txt` as admin must create **3 projects and 12 tasks**:

| Project | Client | Manager | Deadline | Hours |
|---|---|---|---|---|
| UrbanCart Website | UrbanCart Clothing | PM01 Ayesha | 2026-10-20 | 40 |
| QuickServe Mobile App | QuickServe Services | PM02 Bilal | 2026-10-24 | 46 |
| HelpDeskPro AI Assistant | HelpDeskPro Solutions | PM03 Hina | 2026-10-22 | 38 |

| Project / task | Owner | Deadline | Hours |
|---|---|---|---|
| UrbanCart / Product catalog UI | DEV01 Ali | 2026-10-12 | 12 |
| UrbanCart / Demo cart UI | DEV01 Ali | 2026-10-15 | 8 |
| UrbanCart / Product and cart APIs | DEV02 Hamza | 2026-10-14 | 14 |
| UrbanCart / Website integration and testing | DEV01 Ali | 2026-10-19 | 6 |
| QuickServe / Login and profile screens | DEV03 Sara | 2026-10-12 | 8 |
| QuickServe / Service booking screens | DEV03 Sara | 2026-10-17 | 12 |
| QuickServe / Booking and account APIs | DEV02 Hamza | 2026-10-16 | 16 |
| QuickServe / Mobile integration and testing | DEV04 Usman | 2026-10-22 | 10 |
| HelpDeskPro / FAQ document processing | DEV06 Maryam | 2026-10-13 | 10 |
| HelpDeskPro / Assistant answer generation | DEV05 Zain | 2026-10-17 | 14 |
| HelpDeskPro / Human escalation flow | DEV05 Zain | 2026-10-18 | 6 |
| HelpDeskPro / Assistant evaluation and testing | DEV06 Maryam | 2026-10-21 | 8 |

Traps the AI must get right:
- The UrbanCart deadline is **20 Oct**, not 18 Oct.
- UrbanCart integration is due **19 Oct**, not 17 Oct.
- QuickServe integration is **10h**, not 8h.
- HelpDeskPro testing belongs to **Maryam**, not Zain.
- **Kamran** is not an employee.
- **No** payment, inventory, maps, driver-tracking or email/ticketing tasks.

**Changed-input test:** change QuickServe integration's final estimate to 12 hours and its deadline to 23 October in the transcript (both in the 09:28 segment and the final recap). Only that task should change.

---

## 8. Environment variables (backend)

Ship a `backend/.env.example` with placeholders only:

```
PORT=4000
DATABASE_URL=postgres://user:password@host:5432/dbname   # Aiven etc. may need ?sslmode=require
JWT_SECRET=change-me
ANTHROPIC_API_KEY=your-key-here        # or OPENAI_API_KEY, whichever provider is used
AI_MODEL=model-id-here
CORS_ORIGIN=http://localhost:5173      # comma-separate multiple origins; add the deployed frontend URL
```

Never commit a real `.env`.

---

## 9. Hooking it up to the frontend

1. Start the backend (e.g. on port 4000).
2. Create `frontend/.env`:
   ```
   VITE_API_URL=http://localhost:4000
   ```
3. Run `cd frontend && npm run dev` and open http://localhost:5173. The orange "Mock API mode" banner must be **gone**. If it's still showing, `VITE_API_URL` wasn't picked up; restart the dev server.
4. Deployment: set `VITE_API_URL` to the deployed backend URL **at frontend build time** (Vite bakes it in), and add the deployed frontend URL to `CORS_ORIGIN`.

If you must deviate from this contract (e.g. cookies instead of Bearer tokens, or different field names), the frontend changes are limited to `frontend/src/api/client.ts` and `frontend/src/types.ts`. Tell the frontend owner first.

---

## 10. Verification script (run before integrating)

Requires `curl` and `jq`. Run it after seeding and with an empty project table.

```sh
API=http://localhost:4000/api
login() { curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1@novaworks.example\",\"password\":\"Demo123!\"}" | jq -r .token; }

ADMIN=$(login admin); AYESHA=$(login ayesha); ALI=$(login ali); HAMZA=$(login hamza)

# 1. bad login -> 401
curl -s -o /dev/null -w 'bad login: %{http_code}\n' -X POST $API/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"ali@novaworks.example","password":"nope"}'

# 2. no token -> 401
curl -s -o /dev/null -w 'no token: %{http_code}\n' $API/projects

# 3. agent cannot create from transcript -> 403
curl -s -o /dev/null -w 'agent transcript: %{http_code}\n' -X POST $API/transcripts \
  -H "Authorization: Bearer $ALI" -H 'Content-Type: application/json' -d '{"transcript":"x"}'

# 4. admin creates from the supplied transcript -> 201, 3 projects / 12 tasks
jq -Rs '{transcript: .}' ../frontend/public/sample-transcript.txt | \
  curl -s -X POST $API/transcripts -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d @- | \
  jq '{projectCount, taskCount, projects: [.projects[] | "\(.name) / \(.manager.name) / \(.deadline) / \(.totalHours)h"]}'

# 5. role filtering
echo "Ayesha sees:"; curl -s $API/projects -H "Authorization: Bearer $AYESHA" | jq -r '.[].name'      # UrbanCart only
echo "Ali tasks:";   curl -s $API/tasks/mine -H "Authorization: Bearer $ALI" | jq -r '.[].title'      # his 3 tasks
echo "Hamza tasks:"; curl -s $API/tasks/mine -H "Authorization: Bearer $HAMZA" | jq -r '.[] | "\(.project.name) / \(.title)"'  # 2 tasks, 2 projects

# 6. direct access to someone else's project -> 404
QS=$(curl -s $API/projects -H "Authorization: Bearer $ADMIN" | jq -r '.[] | select(.name|test("QuickServe")) | .id')
curl -s -o /dev/null -w 'Ayesha -> QuickServe: %{http_code}\n' $API/projects/$QS -H "Authorization: Bearer $AYESHA"
curl -s -o /dev/null -w 'Ali -> QuickServe: %{http_code}\n'    $API/projects/$QS -H "Authorization: Bearer $ALI"
echo "Hamza sees in QuickServe:"; curl -s $API/projects/$QS -H "Authorization: Bearer $HAMZA" | jq '.tasks | length'  # 1

# 7. invalid draft -> 422 with draft + issues, and nothing saved
curl -s -X POST $API/transcripts -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"draft":{"projects":[{"name":"X","clientName":"Y","description":"","managerId":"Kamran","deadline":"2026-10-20",
       "tasks":[{"title":"T","description":"","assigneeId":"DEV01","deadline":"2026-10-30","estimatedHours":0}]}]}}' | jq

# 8. no password hashes leak
curl -s $API/users -H "Authorization: Bearer $ADMIN" | grep -ci password && echo "LEAK!" || echo "no password fields: ok"
```

Expected: `401`, `401`, `403`, then `projectCount 3` / `taskCount 12` with 40h / 46h / 38h; Ayesha sees UrbanCart only; Ali has 3 tasks; Hamza has 2 tasks across two projects; `404`, `404`, `1`; a 422 listing the `managerId`, `deadline` and `estimatedHours` issues; and no password fields.

---

## 11. Checklist

- [ ] All routes under `/api`, JSON, `{ error }` on failure
- [ ] CORS allows the frontend origin plus the `Authorization` header
- [ ] Seed: 10 users, IDs `ADMIN/PM01-03/DEV01-06`, hashed `Demo123!`, idempotent
- [ ] Reset command for projects and tasks (keeps users)
- [ ] Login returns `{ token, user }`; `/auth/me` restores the session
- [ ] `manager` / `assignee` returned as `{ id, name }`
- [ ] Dates returned as `YYYY-MM-DD` strings
- [ ] `taskCount` / `totalHours` computed from the tasks visible to the caller
- [ ] Visibility rules applied to `/projects`, `/projects/:id` (404) and `/tasks/mine`
- [ ] `/transcripts`: admin-only, real AI call, accepts `{ transcript }` or `{ draft }`
- [ ] 422 returns `{ error, draft, issues[] }` with the exact `path` format
- [ ] Single transaction; nothing saved on failure
- [ ] No passwords sent to the AI or returned by the API
- [ ] Verification script in §10 passes
- [ ] `.env.example` committed; real secrets not committed
