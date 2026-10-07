# NovaWorks AI Project Manager

NovaWorks is a hackathon CRM that turns a meeting transcript into projects and assigned tasks. An administrator submits a transcript, the backend asks an LLM to extract the agreed work, validates the result against the team directory, and saves projects and tasks atomically. Managers and developers then see only the work permitted for their role.

## Features

- Session-based login with seeded demo accounts
- Role-based access control enforced by the API
- Admin transcript-to-project/task workflow
- AI validation with an editable correction screen
- Manager project view and developer “My tasks” view
- Read-only team directory
- PostgreSQL persistence
- Responsive, dependency-free frontend

## Tech stack

- Node.js 20.10+ (Node 22 recommended)
- Plain JavaScript with ES modules
- Express 5, Helmet, CORS, and `express-session`
- PostgreSQL 16 with `pg` and `connect-pg-simple`
- `bcryptjs` for demo-user password hashes
- LLM provider accessed through `fetch` (OpenAI-compatible, Anthropic, or Gemini)
- Frontend: HTML, CSS, and browser JavaScript; no framework or build step
- Tests: Node’s built-in test runner, Supertest, and a Chromium smoke test

## Project structure

```text
backend/
  src/server.js             Backend entry point and startup checks
  src/app.js                Express app factory
  src/config.js             Environment validation
  src/auth/                 Login, logout, session and role middleware
  src/access/               Server-side project/task visibility rules
  src/routes/               Health, team, projects, tasks and transcript APIs
  src/ai/                   LLM client, prompt, parsing, validation and persistence
  db/schema.sql             PostgreSQL schema
  scripts/                  Database, seed, reset and AI utility commands
  tests/                    Backend unit/integration tests
  docs/API.md               API contract

frontend/
  server.js                 Static file server and `/api` development proxy
  public/index.html         HTML shell
  public/app.js             Login, routing, API calls and UI rendering
  public/styles.css         Responsive visual design
  public/transcript.txt     Supplied demo transcript
  tests/                    Static-server and browser smoke tests
```

## Requirements

- Node.js 20.10 or newer
- PostgreSQL 16, either locally or through Docker
- An LLM API key configured only in `backend/.env`

## First-time setup

From the repository root:

```sh
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at least:

```dotenv
DATABASE_URL=postgres://novaworks:novaworks@127.0.0.1:5432/novaworks
TEST_DATABASE_URL=postgres://novaworks:novaworks@127.0.0.1:5432/novaworks_test
SESSION_SECRET=replace-with-a-long-random-value
CLIENT_URL=http://localhost:5173
LLM_PROVIDER=openai
LLM_API_KEY=replace-with-your-provider-key
LLM_MODEL=replace-with-your-model
LLM_BASE_URL=https://openrouter.ai/api/v1
```

Never commit `.env` or paste a real API key into source files, documentation, or chat. Rotate any key that has been exposed.

### PostgreSQL with Docker

```sh
cd backend
npm install
npm run db:up
npm run db:init
npm run db:seed
```

### Existing PostgreSQL installation

Create the `novaworks` and `novaworks_test` databases, update the two connection strings in `backend/.env`, then run:

```sh
cd backend
npm install
npm run db:init
npm run db:seed
```

The seed script is idempotent and creates the ten demo accounts. All demo accounts use `Demo123!` unless `DEMO_PASSWORD` is changed.

## Run the application

Start the API in one terminal:

```sh
cd backend
npm start
```

Start the frontend in a second terminal:

```sh
cd frontend
npm start
```

Open [http://localhost:5173](http://localhost:5173). The frontend server serves `frontend/public` and proxies `/api/*` to `http://127.0.0.1:4000`.

For automatic frontend restarts during development:

```sh
cd frontend
npm run dev
```

## Demo accounts and workflow

All accounts use password `Demo123!`:

| Account | Role | Expected access |
|---|---|---|
| `admin@novaworks.example` | Administrator | All projects, team directory, transcript creation |
| `ayesha@novaworks.example` | Manager | Projects managed by Ayesha and their tasks |
| `ali@novaworks.example` | Developer | Ali’s assigned tasks and related projects |
| `hamza@novaworks.example` | Developer | Hamza’s assigned tasks and related projects |

To demonstrate the AI workflow:

1. Log in as the administrator.
2. Open **Create from transcript**.
3. Click **Load demo transcript**, or paste a modified transcript.
4. Submit **Create projects & tasks**.
5. If the AI returns unresolved fields, choose the correct manager/assignee or edit the values.
6. Submit **Save corrected plan**.
7. Switch accounts to verify role-scoped projects and tasks.

The backend, not the frontend, enforces all permissions. A transcript is saved only after the complete draft passes validation.

## Reset demo work

Remove generated projects and tasks while keeping users:

```sh
cd backend
npm run db:reset-work
```

Load the deterministic development fixture when you want populated screens without an LLM call:

```sh
cd backend
npm run dev:fixture
```

The fixture is for development/testing and is not part of the production startup path.

## Testing

Backend tests:

```sh
cd backend
npm test
```

Frontend static-server tests:

```sh
cd frontend
npm test
```

Browser smoke test (keep both servers running first):

```sh
cd frontend
node tests/browser-smoke.js
```

Useful backend checks:

```sh
cd backend
npm run llm:smoke
npm run test:ai
```

## API overview

The backend API is served under `/api`:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/health`
- `GET /api/team`
- `GET /api/projects`
- `GET /api/projects/:id`
- `GET /api/tasks/mine`
- `POST /api/transcript/create` (administrator only)
- `POST /api/transcript/commit` (administrator only)

See [backend/docs/API.md](backend/docs/API.md) for response shapes, error codes, access rules, and the transcript correction flow.

## Configuration notes

- `CLIENT_URL` must include the frontend origin.
- `COOKIE_SECURE=true` is required for HTTPS production deployments.
- Use `COOKIE_SAMESITE=none` only when frontend and API are hosted on different sites and HTTPS is enabled.
- `DATABASE_SSL=true` is used for hosted PostgreSQL providers.
- Do not enable `DEBUG_AI` in production.

## Production considerations

The included frontend server is intended for local development and demos. For deployment, serve `frontend/public` from an HTTPS host or CDN and proxy `/api` to the backend. Set production environment variables, use a hosted PostgreSQL database, configure the exact frontend origin in `CLIENT_URL`, and keep all secrets in the host’s environment settings.
