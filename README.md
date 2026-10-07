# NovaWorks CRM - AI Meeting to Project CRM

A small project-management CRM for the fictional **NovaWorks Technologies** (The Infinity Hack '26, *AI Project Manager - Meeting to Execution*).
The admin pastes a meeting transcript and clicks **Create from Transcript**. AI then creates the projects and tasks, assigns the managers and developers from the team directory, and sets deadlines and estimated hours. Managers and developers log in and see only their own work.

## Team
- Team name: **Coders**
- Members and responsibilities:
  - **Athar Abbas**: frontend (React app, UI and theme, frontend–backend integration contract)
  - **Moaz Nadeem**: AI integration (OpenRouter provider, prompt, structured output and validation)
  - **Mukaram Nadeem**: backend (Express API, database, auth, role-based access)
  - **Hamza Usman**: testing (end-to-end checks of the demo flow and access rules)
- Repository: https://github.com/MukaramNadeem/infinity-hack

## What Works
- **Login/logout** with the ten seeded demo accounts. No signup, password reset or user management, as the brief specifies.
- **Admin:** sees all project cards with summary stats, plus **Create from Transcript**.
  - Paste the meeting, or click **Load supplied transcript**, then click Create.
  - The AI extracts 3 projects and 12 tasks, using only people from the directory.
  - Shows a loading state, then the created projects or a clear error. The button is disabled while processing.
- **Draft validation and correction:** the AI draft is validated before anything is saved.
  - If a person, date or hours value is invalid, nothing is saved. The admin sees each issue next to the field, corrects it and saves again.
  - Saving is all-or-nothing (one database transaction).
  - Re-importing the same transcript is blocked (`409`).
- **Manager:** sees only the projects they manage, with all tasks in them.
- **Developer (agent):** lands on **My Tasks** and sees only their own tasks and the related projects.
- **Project detail:** client, manager, deadline and totals, plus task rows with title, description, assignee, deadline and estimated hours.
- **Team directory:** read-only, with names, roles, specializations and skills.
- **Role-based access is enforced by the API on every request**, not only hidden in the UI:
  - Another user's project or task returns `404`.
  - A non-admin calling the transcript endpoint gets `403`.
  - No or invalid token gets `401`.
- **Saved records** persist in the database across refreshes and server restarts.
- **Tests:** 122 backend tests (Jest + Supertest) cover auth, role-based access, validation and the transcript flow.

Not included (not required by the brief): signup, password reset, user management, cost calculation and progress monitoring.

## Technology Stack
- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, React Router 7. Theme based on the DashStack Figma UI kit.
- **Backend:** Node.js (20+, tested on 22 and 24), Express 5, TypeScript 5.9, Zod 4 validation. OpenAPI docs at `/api/docs`.
- **Database:** SQLite through Prisma 6.19 (file `backend/prisma/dev.db`).
- **AI:** OpenRouter (OpenAI-compatible API), model `openai/gpt-4o-mini` (set with `AI_MODEL`), JSON-schema structured output validated with Zod.
  - The AI receives only each person's directory code, name, role, specialization and skills, never emails or passwords.
  - An offline mock provider is used for tests.
- **Authentication:**
  - Passwords are hashed with bcrypt.
  - `POST /api/auth/login` returns a JWT, and the frontend sends it as `Authorization: Bearer <token>`.
  - The server determines the current user from the token only, never from a role or ID sent by the client.

## Links
- Live application: **Not deployed** (local demo).
- Demo video: [docs/demo-video.webm](https://github.com/MukaramNadeem/infinity-hack/raw/main/docs/demo-video.webm) (about 1 minute; open the link to play or download)

## Requirements
- Node.js 20 or newer, and npm
- Git
- No database server needed: SQLite is a local file that Prisma creates.
- An [OpenRouter](https://openrouter.ai) API key for the real AI.
  - Without a key, `AI_MOCK="true"` runs an offline mock that only understands the supplied transcript's final-recap format.

## Run Locally
1. Clone this repository and enter its directory:
   ```sh
   git clone https://github.com/MukaramNadeem/infinity-hack.git
   cd infinity-hack
   ```
2. Install dependencies (backend and frontend are separate folders):
   ```sh
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```
3. Copy the provided env examples:
   ```sh
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
4. Edit `backend/.env`:
   - Set `JWT_SECRET` to a long random string. You can generate one with:
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - For the real AI, set `OPENROUTER_API_KEY` to your key and `AI_MOCK="false"`.
   - `frontend/.env` already points at `http://localhost:4000`. No change is needed.
5. Create the database: the SQLite file `backend/prisma/dev.db` is created by the migration in the next step. No separate database server is needed.
6. Apply schema/migrations:
   ```sh
   cd backend
   npm run db:deploy
   ```
7. Seed all ten demo users (still in `backend/`). Re-running it never duplicates users:
   ```sh
   npm run db:seed
   ```
8. Start the backend and frontend in **two terminals**, and keep both running:
   ```sh
   # Terminal 1: API on http://localhost:4000/api (docs at http://localhost:4000/api/docs)
   cd backend && npm run dev

   # Terminal 2: web app on http://localhost:5173
   cd frontend && npm run dev
   ```
   Open **http://localhost:5173** in the browser.
   The frontend must run on port 5173, because that is the origin the backend allows (`FRONTEND_URL`).

Optional: `cd backend && npm test` runs the 122 backend tests. They use a separate test database and the mock AI, so they never call the real API.

## Environment Variables
| Variable | Purpose | Where configured |
| --- | --- | --- |
| `DATABASE_URL` | SQLite database file (default `file:./dev.db`) | `backend/.env` |
| `JWT_SECRET` | Signs login tokens (min. 16 characters) | `backend/.env` |
| `JWT_EXPIRES_IN` | Login token lifetime (default `8h`) | `backend/.env` |
| `OPENROUTER_API_KEY` | AI provider credential | `backend/.env` only |
| `AI_MODEL` | AI model selection (default `openai/gpt-4o-mini`) | `backend/.env` |
| `AI_MOCK` | `"false"` = real AI via OpenRouter (use for judging); `"true"` = offline mock | `backend/.env` |
| `FRONTEND_URL` | Browser origin(s) allowed by CORS (default `http://localhost:5173`) | `backend/.env` |
| `PORT` / `HOST` | API port and listen address (defaults `4000` / `0.0.0.0`) | `backend/.env` |
| `VITE_API_URL` | Backend base URL used by the frontend (`http://localhost:4000`) | `frontend/.env` |
| `VITE_USE_MOCK` | `"true"` runs the frontend against its built-in in-browser mock API (UI demo without a backend) | `frontend/.env` |

`.env` files are git-ignored. Only `.env.example` files with placeholders are committed. The AI key and database settings live in the backend only and are never exposed to the browser.

## Demo Login Accounts
These emails are fictional identifiers, not mailboxes. Signup, email verification and forgot password are unnecessary.

| Role | Name | Demo email | Password |
| --- | --- | --- | --- |
| Admin | Admin | admin@novaworks.example | Demo123! |
| Manager | Ayesha Khan | ayesha@novaworks.example | Demo123! |
| Manager | Bilal Ahmed | bilal@novaworks.example | Demo123! |
| Manager | Hina Malik | hina@novaworks.example | Demo123! |
| Developer | Ali Raza | ali@novaworks.example | Demo123! |
| Developer | Hamza Shah | hamza@novaworks.example | Demo123! |
| Developer | Sara Noor | sara@novaworks.example | Demo123! |
| Developer | Usman Tariq | usman@novaworks.example | Demo123! |
| Developer | Zain Abbas | zain@novaworks.example | Demo123! |
| Developer | Maryam Asif | maryam@novaworks.example | Demo123! |

The accounts are created by `cd backend && npm run db:seed` (step 7 above). Run it once after the migrations. Running it again is safe.
The login page also lists these accounts: click one to fill in the form.

## How Judges Can Test
1. Log in as admin, then open **Create from Transcript** (button on the Projects page, or **Import Transcript** in the sidebar).
2. Paste the supplied meeting transcript, or click **Load supplied transcript**. The file is `frontend/public/sample-transcript.txt`, also in `backend/tests/fixtures/meeting-transcript.txt`.
3. Click **Create from Transcript**. Expect **3 projects and 12 tasks** (UrbanCart 40 h, QuickServe 46 h, HelpDeskPro 38 h). The real AI takes a few seconds.
4. Open **UrbanCart Website**: manager Ayesha Khan, deadline 20 Oct 2026, four tasks.
5. Log out and log in as **Ayesha**: only *UrbanCart Website* appears.
6. Log in as **Ali**: My Tasks shows only his three UrbanCart tasks.
7. Log in as **Hamza**: his two API tasks span UrbanCart and QuickServe.
8. Verify other users' data can't be fetched directly:
   - As Ali, open the URL of the QuickServe or HelpDeskPro project: you get "Project not found".
   - Direct API calls give the same result: `GET /api/projects/{id}` returns `404`, and `POST /api/transcripts` as a non-admin returns `403`.
   - You can try these in the Swagger UI at http://localhost:4000/api/docs (log in, then click **Authorize**).
9. Refresh the page or restart the servers: the projects and tasks are still there.
10. Test a modified transcript:
    - Reset the demo data (below), then edit the transcript before creating.
    - For example, change QuickServe's integration task to *12 hours, 23 October* in both the discussion and the final recap.
    - Only *Mobile integration and testing* should change.

**Reset generated projects/tasks between tests (keeps the ten users):**
```sh
cd backend && npm run db:reset-demo
```
Importing the same transcript twice without a reset is refused with a "duplicate transcript" message.

## Deployment Details
- Deployment status: **Local only**
- Frontend host: Not deployed (runs locally with `npm run dev` at http://localhost:5173)
- Backend host: Not deployed (runs locally with `npm run dev` at http://localhost:4000)
- Database: local SQLite file (`backend/prisma/dev.db`) via Prisma
- Deployed branch/commit: n/a (submission branch: `main`)

### How We Deployed
The project is not deployed. It is submitted as a local demo, with the [demo video](https://github.com/MukaramNadeem/infinity-hack/raw/main/docs/demo-video.webm). Run it with the steps in [Run Locally](#run-locally).

## Known Limitations
- **Not deployed and no hosted database.** It runs locally with SQLite. Moving to hosted PostgreSQL (e.g. Aiven) needs these steps:
  1. Switch the Prisma provider to `postgresql` and point `DATABASE_URL` at the hosted database.
  2. Regenerate the migrations.
  3. Run `db:deploy` and `db:seed` against it.
- **The real AI needs an OpenRouter key and network access.** AI output can vary slightly between runs. It is always validated before saving, so a bad extraction shows issues to correct and is never saved half-way.
- **`AI_MOCK="true"` is not a language model.** It only parses the supplied transcript's "Final recap" sentence format. Use the real AI for judging and for other transcripts.
- **Re-importing the same transcript requires a reset** (`npm run db:reset-demo`).
- **Logout is client-side.** It deletes the token, and the JWT stays valid until it expires (`JWT_EXPIRES_IN`, default 8 h).
- **Editing projects/tasks is API-only.** The API supports it, but there are no edit screens in the UI. Editing was optional in the brief.

More backend detail (all endpoints, error formats, AI modes, project structure) is in [`backend/README.md`](backend/README.md). The frontend–backend contract is in [`API_CONTRACT.md`](API_CONTRACT.md).

## Submission Summary
- Source repository: https://github.com/MukaramNadeem/infinity-hack
- Live link or local demo video: [demo video](https://github.com/MukaramNadeem/infinity-hack/raw/main/docs/demo-video.webm) (not deployed)
- Setup and seed commands: documented above (`npm run db:deploy`, `npm run db:seed`, `npm run dev` in `backend/` and `frontend/`)
- Demo login accounts: confirmed working (all ten, password `Demo123!`)
- Features completed:
  - seeded login/logout
  - admin transcript → 3 projects / 12 tasks via real AI
  - validation with a correction screen
  - all-or-nothing save
  - manager project view
  - agent My Tasks view
  - project detail with task rows
  - team directory
  - server-side role-based access
  - persistent storage
  - 122 backend tests
