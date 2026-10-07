# NovaWorks PM CRM — Backend API

Backend for the **NovaWorks Technologies** project-management CRM (The Infinity Hack '26, *AI Project Manager — Meeting to Execution*).
The admin pastes a meeting transcript; AI extracts the projects and tasks, assigns the managers and developers from the team directory,
sets deadlines and estimated hours, and saves everything. Managers and developers log in and see only their own work.

The frontend is built separately and talks to this API. **Interactive API docs with request/response examples: `http://localhost:4000/api/docs`.**

## What works

- **Login** with ten pre-seeded demo accounts (JWT). No signup or password reset, as specified.
- **Team directory**: read-only, with names, emails, roles, specializations and skills.
- **Projects and tasks**: client, manager, deadline, members and task list, plus task title, description, assignee, deadline, estimated hours and status.
- **Create from Transcript** (admin only):
  - The AI turns a meeting into projects and tasks, using only people who exist in the directory.
  - Everything is validated, then saved in one transaction: all of it or nothing.
  - Unresolvable information (an unknown person, a missing date, …) comes back as a list of issues plus the draft, so the admin can correct it and commit.
  - Re-importing the same transcript and double clicks are blocked.
- **Role-based access**, enforced on every request (not just hidden in the UI):

  | Role | Projects | Tasks |
  |---|---|---|
  | ADMIN | all | all |
  | MANAGER | projects they manage | all tasks in those projects |
  | DEVELOPER | projects containing their tasks | only tasks assigned to them; may only change a task's `status` |

  Anything outside a user's scope returns `404`.
- **Tests**: 120 Jest + Supertest tests. They use a separate test database and an offline mock AI.
- **Real-AI result**: the supplied transcript, run through OpenRouter with `openai/gpt-4o-mini`, produced 3 projects and 12 tasks matching the organizer answer key exactly. The changed-input test (QuickServe integration at 12 h, due 23 Oct) changed only that task.

## Technology stack

| | |
|---|---|
| Runtime | Node.js (tested on 24.20) · TypeScript 5.9 |
| API | Express 5 · Zod 4 validation · OpenAPI 3 docs (Swagger UI) |
| Database | SQLite via Prisma 6.19 |
| Auth | JWT (`jsonwebtoken`), passwords hashed with bcrypt (`bcryptjs`) |
| AI | OpenRouter (OpenAI-compatible API) through the `openai` SDK; model set by `AI_MODEL`. JSON-schema structured output, validated with Zod. Offline mock provider for dev and tests. |
| Tests | Jest 30 · Supertest 7 |

## Requirements

- Node.js 20 or newer, and npm.
- For the real AI: an [OpenRouter](https://openrouter.ai) API key. Without one, set `AI_MOCK="true"` (see [AI modes](#ai-modes)).

## Run locally

All commands run from the `backend/` folder.

```sh
cd backend

# 1. Install dependencies
npm install

# 2. Create your environment file, then edit it
cp .env.example .env
#    - set JWT_SECRET to a long random string, e.g. the output of:
#        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    - for the real AI: set OPENROUTER_API_KEY and AI_MOCK="false"

# 3. Create the SQLite database (prisma/dev.db) from the migrations
npm run db:deploy

# 4. Seed the ten demo users (safe to re-run; it never duplicates users)
npm run db:seed

# 5. Start the API (auto-reloads on code changes)
npm run dev
```

Keep `npm run dev` running. The API is at **http://localhost:4000/api** and the docs at **http://localhost:4000/api/docs**.
The frontend dev server is expected at `http://localhost:5173`; change `FRONTEND_URL` if yours runs elsewhere.

```sh
# 6. Run the tests (separate database at prisma/test.db, mock AI, never calls the real API)
npm test
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run db:reset-demo` | Deletes all projects, tasks and imported transcripts; **keeps the users**. Use it between transcript demos. |
| `npm run db:migrate` | Create and apply a new migration after editing `prisma/schema.prisma` (development). |
| `npm run db:studio` | Browse the database in Prisma Studio. |
| `npm run typecheck` | TypeScript check of the app and the tests. |
| `npm run build` then `npm start` | Production build (`dist/`) and start. |

## Environment variables

Configured in `backend/.env`. See `backend/.env.example`; never commit `.env`.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite file, relative to `prisma/schema.prisma` | `file:./dev.db` |
| `JWT_SECRET` | Signs login tokens (min. 16 characters) | — (required) |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` |
| `OPENROUTER_API_KEY` | OpenRouter API key (backend only) | — |
| `AI_MODEL` | OpenRouter model id; change models without code changes | `openai/gpt-4o-mini` |
| `AI_MOCK` | `"true"` = offline mock AI, `"false"` = real AI via OpenRouter | `false` (`.env.example` sets `"true"`) |
| `FRONTEND_URL` | Origin(s) allowed by CORS; comma-separate several | `http://localhost:5173` |
| `PORT` | API port | `4000` |

## Demo login accounts

The emails are fictional identifiers, not real mailboxes. Every password is **`Demo123!`**. They are created by `npm run db:seed`.

| Role | Name | Email | Password | Directory code |
|---|---|---|---|---|
| Admin | Admin | admin@novaworks.example | Demo123! | ADMIN |
| Manager (Web PM) | Ayesha Khan | ayesha@novaworks.example | Demo123! | PM01 |
| Manager (Mobile PM) | Bilal Ahmed | bilal@novaworks.example | Demo123! | PM02 |
| Manager (AI PM) | Hina Malik | hina@novaworks.example | Demo123! | PM03 |
| Developer (Full-Stack) | Ali Raza | ali@novaworks.example | Demo123! | DEV01 |
| Developer (Full-Stack) | Hamza Shah | hamza@novaworks.example | Demo123! | DEV02 |
| Developer (App) | Sara Noor | sara@novaworks.example | Demo123! | DEV03 |
| Developer (App) | Usman Tariq | usman@novaworks.example | Demo123! | DEV04 |
| Developer (AI) | Zain Abbas | zain@novaworks.example | Demo123! | DEV05 |
| Developer (AI) | Maryam Asif | maryam@novaworks.example | Demo123! | DEV06 |

## AI modes

| `AI_MOCK` | Behaviour |
|---|---|
| `"false"` | **Real AI.** The transcript and the directory are sent to OpenRouter (`AI_MODEL`). Only code, name, role, specialization and skills are sent; never emails or passwords. The prompt tells the model to use final decisions, drop rejected features and never invent people. |
| `"true"` | **Offline mock**, for development and tests. It is *not* a language model: it only parses the sample meeting's "Final recap" sentence format (`Ali owns Product catalog UI: 12 hours, 12 October.`). Edits to the recap still change the result. Use the real AI for judging and for other transcripts. |

## Try the transcript flow

The supplied meeting is in [`backend/tests/fixtures/meeting-transcript.txt`](backend/tests/fixtures/meeting-transcript.txt).
With the server running (in another terminal, from `backend/`):

```sh
# Log in as admin
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@novaworks.example","password":"Demo123!"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# Create from Transcript
node -e 'process.stdout.write(JSON.stringify({ transcript: require("fs").readFileSync("tests/fixtures/meeting-transcript.txt", "utf8"), meetingDate: "2026-10-07" }))' \
  | curl -s -X POST localhost:4000/api/transcripts -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data-binary @- \
  | node -pe 'const r = JSON.parse(require("fs").readFileSync(0)); JSON.stringify(r.totals ?? r, null, 2)'
```

Expected result: `{ "projects": 3, "tasks": 12, "estimatedHours": 124 }`. Running it again returns `409 DUPLICATE_TRANSCRIPT`; run `npm run db:reset-demo` first to import it again.
You can also do all of this from the Swagger UI at `/api/docs`: log in, click **Authorize**, and paste the token.

### How judges can test (challenge section 8)

| Step | API call | Expected |
|---|---|---|
| Log in as admin, create from transcript | `POST /api/transcripts` | 201: 3 projects, 12 tasks |
| Open UrbanCart | `GET /api/projects/{id}` | manager Ayesha, deadline 2026-10-20, 4 tasks (40 h) |
| Log in as Ayesha | `GET /api/projects` | only *UrbanCart Website* |
| Log in as Ali | `GET /api/tasks` | only his 3 UrbanCart tasks |
| Ali opens another project or task directly | `GET /api/projects/{QuickServe id}` | `404` |
| Log in as Hamza | `GET /api/tasks` | 2 tasks across UrbanCart and QuickServe |
| Refresh | any `GET` | data is persisted in SQLite |
| Changed input: in the transcript, change QuickServe integration to 12 hours and 23 October, then reset and re-import | `POST /api/transcripts` | only *Mobile integration and testing* changes (12 h, 2026-10-23) |

## API overview

Full reference with schemas and examples: **`/api/docs`** (raw spec: `/api/docs/openapi.json`, source: [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml)).
All endpoints are under `/api`. Every request except login, health and docs needs `Authorization: Bearer <token>`.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /auth/login` · `GET /auth/me` · `POST /auth/logout` | all | Log in (returns `{ token, user }`), current user, log out |
| `GET /users` · `GET /users/{id}` | all | Team directory (`?role=MANAGER\|DEVELOPER`) |
| `GET /projects` · `GET /projects/{id}` | all (filtered) | Project cards / detail with tasks |
| `GET /projects/{id}/tasks` | all (filtered) | Tasks of one project (`?status=&assigneeId=`) |
| `POST /projects` | ADMIN | Create a project manually (optionally with tasks) |
| `PATCH /projects/{id}` | ADMIN, its manager | Edit project (only ADMIN can change the manager) |
| `DELETE /projects/{id}` | ADMIN | Delete project and its tasks |
| `POST /projects/{id}/tasks` | ADMIN, its manager | Add a task |
| `GET /tasks` · `GET /tasks/{id}` | all (filtered) | "My Tasks" for developers (`?projectId=&status=&assigneeId=`) |
| `PATCH /tasks/{id}` | ADMIN, its manager; assigned developer: `status` only | Edit task |
| `DELETE /tasks/{id}` | ADMIN, its manager | Delete task |
| `POST /transcripts` | ADMIN | **Create from Transcript** (AI → validate → save) |
| `POST /transcripts/extract` | ADMIN | Preview the AI draft and issues, saves nothing |
| `POST /transcripts/commit` | ADMIN | Save an admin-corrected draft (re-validated) |
| `GET /transcripts` · `GET /transcripts/{id}` | ADMIN | Past imports |
| `GET /health` | public | Liveness |

**Notes for the frontend**

- Dates are `YYYY-MM-DD` strings.
- Errors are always `{ "error": { "code", "message", "details"? } }`. Validation errors list every problem in `details: [{ path, message }]`.
- **Create from Transcript** takes a few seconds with the real AI: show a loading state and disable the button.
  - `201` — show `totals` and `projects`.
  - `422 DRAFT_INVALID` — show `error.details` next to the fields of the returned `draft`, let the admin fix them, then send `{ transcript, draft }` to `POST /transcripts/commit`.
  - `409` — duplicate or already processing.
  - `502` / `503` — AI problem; nothing was saved.
- A developer's project view only contains their own tasks. `taskCount`, `totalEstimatedHours` and `members` follow the same rule.

## Project structure

```
backend/
  prisma/            schema.prisma, migrations/, seed.ts (demo users), reset-demo.ts
  docs/openapi.yaml  API documentation served at /api/docs
  src/
    app.ts           Express app (routers, CORS, docs, error handling); server.ts starts it
    config/env.ts    Zod-validated environment variables
    access/scope.ts  Who can see which projects/tasks (single source of truth)
    middleware/      authenticate (JWT), requireRole, validate (Zod), cors, errorHandler
    modules/         auth, users, projects, tasks, transcripts (routes → controller → service)
    ai/              AiProvider interface, OpenRouter provider, mock provider, prompt, output schema
  tests/             Jest + Supertest suites, fixtures/meeting-transcript.txt
```

## Deployment

Not deployed yet; this version runs locally with SQLite. To move to a hosted PostgreSQL database later (e.g. Aiven):
1. Set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at the hosted database.
3. Regenerate the migrations.
4. Run `npm run db:deploy && npm run db:seed` against it.
5. Add the deployed frontend URL to `FRONTEND_URL`.

## Known limitations

- **The mock AI only understands the sample's recap format.** Use `AI_MOCK="false"` with a key for any other transcript.
- **Real-AI output can vary between runs.** It is validated before saving, so a bad extraction is rejected with a list of issues, never saved half-way.
- **Logout is client-side.** It deletes the token; JWTs stay valid until they expire (`JWT_EXPIRES_IN`).
- **The double-submit guard is in-memory.** It works for a single server process; the duplicate-transcript check is stored in the database.
- **The database is SQLite and local only;** see [Deployment](#deployment).

## Team and submission

> To be completed by the team before submission: team name, members and responsibilities, repository URL, frontend location,
> live link or demo video, and deployment details (see `README_Template (1).md`).
