# NovaWorks CRM: Frontend Guide

How the frontend in `frontend/` is built: every module and function, how they connect, and how to integrate with the backend.

Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + React Router, styled after the DashStack Figma kit.

---

## 1. The big picture

```
Browser
  index.html ──► main.tsx ──► App.tsx  (router + auth guard)
                                 │
                 ┌───────────────┼──────────────────┐
              auth.tsx       Layout.tsx          pages/*.tsx
          (who is logged in) (sidebar, header)  (Login, Projects, …)
                 │                                   │
                 └──────────────┬────────────────────┘
                                ▼
                          api/client.ts   ◄── single gateway for ALL data
                                │
                 ┌──────────────┴──────────────┐
          VITE_API_URL set?                   no
                 ▼                             ▼
     fetch(`${API_URL}/api/...`)        api/mock.ts (fake backend
     = teammates' real backend           in the browser, localStorage)
```

Three rules hold the design together:
1. **Pages never call `fetch` themselves.** They call `api.something()` from `client.ts`.
2. **`types.ts` defines the data shapes**, mirroring `API_CONTRACT.md`. Frontend, fake backend and real backend all agree on them.
3. **Fake and real backend are interchangeable.** Switching between them is one setting, `VITE_API_URL`; no code changes.

---

## 2. Running it

```sh
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL to the backend, or leave it empty for the fake backend
npm run dev               # http://localhost:5173
npm run build             # production build into dist/
```

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL, e.g. `http://localhost:4000`, with no trailing `/`. Empty means the fake backend is used. |
| `VITE_USE_MOCK` | `true` forces the fake backend even when `VITE_API_URL` is set. |

---

## 3. Startup sequence

- **`index.html`**: the single HTML page. It loads the Nunito Sans font (DashStack's font) from Google Fonts, has an empty `<div id="root">`, and loads `/src/main.tsx`.
- **`main.tsx`**: mounts React into `#root`, imports `index.css` (the Tailwind theme) and renders `<App />`. `StrictMode` only adds extra checks during development.
- **`vite.config.ts`**: the build tool's config. It turns on the React plugin and the Tailwind plugin.

---

## 4. `src/types.ts`: the data shapes

No logic here, only TypeScript types that match `API_CONTRACT.md`.

| Type | Meaning |
|---|---|
| `Role` | `'ADMIN' \| 'MANAGER' \| 'AGENT'` |
| `User` | a person from the directory (no password, ever) |
| `UserRef` | `{id, name}`: a lightweight pointer to a person, used inside projects and tasks |
| `Task` | one task: title, description, `assignee`, deadline, hours |
| `ProjectSummary` | a project card: client, manager, deadline, plus `taskCount` and `totalHours` |
| `ProjectDetail` | `ProjectSummary` plus a `tasks[]` list |
| `MyTask` | a `Task` plus its parent `project` info (for the agent's My Tasks page) |
| `Draft`, `DraftProject`, `DraftTask` | the **AI output shape** from the brief (uses `managerId`/`assigneeId`) |
| `TranscriptResult` | the reply when the transcript is saved: projects plus counts |
| `DraftIssue` | `{path, message}`: one validation problem, e.g. `projects[1].tasks[2].assigneeId` |
| `LoginResponse` | `{token, user}` |

If the backend renames a field, this file and `client.ts` are the only places to update.

---

## 5. `src/api/client.ts`: the gateway to the backend

**Constants**
- `API_URL`: read from `VITE_API_URL`, with any trailing `/` removed.
- `USE_MOCK`: true if `VITE_USE_MOCK=true` **or** no `API_URL` is set. This one flag decides fake vs. real.

**Token handling** (the login token)
- `getToken()` / `setToken(token)` read and write the token in `localStorage` under `nw_token`. Both are wrapped in `try/catch` because storage can be blocked, e.g. in private mode. If it is, you simply have to log in again after a refresh.

**`ApiError`**: a custom error class that carries the HTTP `status` and the response `body`. Its message is the backend's `{error: "..."}` text, so pages can show it directly.

**`setUnauthorizedHandler(fn)`**: registers what to do when the backend answers **401** (token expired or invalid). `auth.tsx` registers a function that logs the user out, so `client.ts` doesn't need to know about React.

**`request(method, path, body)`**: the core function every API call goes through.
1. Builds the headers: `Content-Type: application/json` if there's a body, and `Authorization: Bearer <token>` if logged in.
2. Sends the request to `mockFetch` (fake mode) or `fetch(API_URL + '/api' + path)` (real mode).
3. A network failure (backend not running) becomes "Cannot reach the server…".
4. `204` means no content, so it returns nothing.
5. It parses the JSON. A non-2xx status throws `ApiError`; a 401 also triggers the unauthorized handler (except on the login call itself, where 401 just means a wrong password).

**`api` object**: one function per endpoint in the contract.

| Function | Request |
|---|---|
| `api.login(email, password)` | `POST /api/auth/login` |
| `api.me()` | `GET /api/auth/me` |
| `api.logout()` | `POST /api/auth/logout` |
| `api.users()` | `GET /api/users` |
| `api.projects()` | `GET /api/projects` |
| `api.project(id)` | `GET /api/projects/:id` |
| `api.myTasks()` | `GET /api/tasks/mine` |
| `api.fromTranscript(text)` | `POST /api/transcripts {transcript}` |
| `api.fromDraft(draft)` | `POST /api/transcripts {draft}` |

**`draftErrorOf(err)`**: checks whether an error is the special **422 "AI draft invalid"** response. If so it returns `{draft, issues}`, and the transcript page uses that to show the correction form. Any other error returns `null`.

---

## 6. `src/api/mock.ts`: the fake backend

This is a pretend server running inside the browser, so the frontend could be built without the real backend. **It's for development only.** Once `VITE_API_URL` is set, it's never used.

- `USERS`: the 10 demo users hardcoded with IDs `ADMIN`, `PM01–03`, `DEV01–06`. `PASSWORD = 'Demo123!'`.
- `REFERENCE_DRAFT`: the correct answer from the brief (3 projects, 12 tasks). The fake "AI" just returns this; it's **not real AI**.
- `load()` / `save()` / `resetMockDb()`: keep fake projects and tasks in `localStorage` (`nw_mock_db`), so they survive a refresh. Clear localStorage to reset.
- `json(status, body)`: builds a `Response` object, so the mock looks exactly like a real `fetch` result.
- `ref(id)`: turns a user ID into `{id, name}`.
- `isDate(s)`: checks the `YYYY-MM-DD` format.
- **Access rules** (the same ones the real backend must enforce):
  - `visibleProjects(db, me)`: admin sees all; manager sees `managerId == me`; agent sees projects containing one of their tasks.
  - `visibleTasks(db, me, projectId)`: agents get only their own tasks; admin and managers get all of them.
- `toTask()` / `toSummary()`: convert stored rows into the contract shapes, adding names, `taskCount` and `totalHours`.
- `validate(draft)`: the checks from the brief. Each failure becomes a `DraftIssue`:
  - the manager must be a MANAGER and every assignee an AGENT
  - hours must be over 0
  - dates must be valid, and no task can be due after its project deadline
- `mockFetch(path, init)`: the fake router.
  - It waits 250 ms to feel like a network call, then reads the token (`mock-DEV01` etc.) to find out who's calling.
  - It matches the path and returns the same statuses as the contract (401/403/404/422/201).
  - For `/transcripts`: if the transcript contains `INVALID`, it deliberately breaks the draft (manager "Kamran", a task due too late) so you can see the correction screen.

---

## 7. `src/auth.tsx`: who is logged in

Uses React **Context**, so any component can ask "who is the user?" without the value being passed down through props.

- **`AuthProvider`** wraps the whole app and holds `user` (or `null`) and `loading`.
  - On first load (`useEffect`): it registers the 401 handler. If a token is saved it calls `api.me()` to restore the session after a refresh; if that fails, it deletes the bad token. `loading` becomes `false` either way.
  - `login(email, password)` calls `api.login`, saves the token and sets `user`.
  - `logout()` calls `api.logout` (errors ignored), clears the token and sets `user = null`.
- **`useAuth()`**: a hook that pages call to get `{user, loading, login, logout}`.

---

## 8. `src/App.tsx`: routes and access guards

- **`RequireAuth({children, roles})`**: a guard component.
  - Still loading: shows a spinner.
  - Not logged in: redirects to `/login`.
  - Wrong role: redirects to `/`.
  - Otherwise: shows the page.
- **`Home()`**: sends agents to `/my-tasks` and everyone else to `/projects`.

| URL | Page | Who |
|---|---|---|
| `/login` | Login | anyone |
| `/` | Home (redirect) | logged in |
| `/projects` | Projects | logged in |
| `/projects/:id` | ProjectDetail | logged in |
| `/team` | Team | logged in |
| `/my-tasks` | MyTasks | AGENT only |
| `/transcript` | CreateFromTranscript | ADMIN only |
| anything else | redirect to `/` | |

All logged-in routes sit inside `<Layout />`, which draws the sidebar. The page itself appears where Layout puts `<Outlet />`.

> ⚠️ These role checks only **hide screens**. Real security has to be in the backend: an agent could still call the API directly. The brief explicitly requires the backend to enforce it.

---

## 9. `src/components/ui.tsx`: shared building blocks

| Export | What it does |
|---|---|
| `formatDate(iso)` | `"2026-10-20"` becomes `"20 Oct 2026"` |
| `Icon({src})` | shows a DashStack SVG icon drawn in the current text color (uses a CSS mask) |
| `StatCard` | DashStack stat card: label, big number, colored icon square |
| `Spinner` | loading indicator |
| `ErrorBox` | red error message |
| `Empty` | dashed "nothing here yet" box |
| `RoleBadge` | colored Admin / Manager / Agent label |
| `PageHeader` | page title, subtitle and an optional button on the right |
| `useLoad(fn, deps)` | **the data-fetching hook used by every page.** Runs `fn` (an `api.*` call) and returns `{data, error, loading}`. The `alive` flag stops it updating a page you've already left. `deps` makes it re-run when the value changes (e.g. project `id`). |

---

## 10. `src/components/Layout.tsx`: the app shell (DashStack)

- Builds the navigation `links` **by role**:
  - Projects for everyone ("My Projects" for agents)
  - My Tasks for agents only
  - Import Transcript for the admin only
  - Team for everyone
- `navItem(...)`: styling for a sidebar link. The active page gets the solid blue pill and the blue bar on the left edge, as in DashStack.
- **Sidebar** (`<aside>`, desktop only): the NovaWorks logo, the links with icons, and Logout.
- **Top bar**: an initial-letter avatar, name and role badge. On phones, the links move here because the sidebar is hidden.
- **Mock banner**: an orange strip shown while `USE_MOCK` is on, so you never mistake fake data for real.
- `<Outlet />`: where the current page is drawn.
- `onLogout()`: logs out and goes to `/login`.

---

## 11. The pages (`src/pages/`)

### `Login.tsx`
- Email and password form. `onSubmit` calls `login()`, then goes to `/`. A wrong password shows the backend's error message.
- The right-hand panel lists the 10 demo accounts. Clicking one fills in the form.
- If you're already logged in, it redirects to `/`.

### `Projects.tsx`
- `useLoad(api.projects)`: the backend already filters by role, so the page just displays whatever comes back.
- `Stats`: three stat cards (projects, tasks and hours, earliest deadline), totaled from that list.
- `ProjectCard`: one clickable card per project (also reused on the transcript success screen).
- The admin also sees the **+ Create from Transcript** button. When there are no projects, it shows an empty-state message.

### `ProjectDetail.tsx`
- Reads `:id` from the URL with `useParams`, then calls `api.project(id)`.
- If the backend says 404 (doesn't exist, **or you're not allowed to see it**), it shows an error and a back link.
- Header card: client, manager, deadline, task count and hours. Agents see "Your tasks".
- `TaskTable`: the task table, also reused by My Tasks. `showProject` adds a project column.

### `MyTasks.tsx` (agents)
- `api.myTasks()`, sorted by deadline, with a count and total hours in the subtitle.
- Reuses `TaskTable` with the project column turned on.

### `Team.tsx`
- `api.users()`, sorted Admin, then Managers, then Agents, shown as cards with a role badge and skill chips. Read-only.

### `CreateFromTranscript.tsx`: the main feature
- `Status` is a set of distinct states, and the page shows exactly one of them at a time:
  - `idle`: nothing yet
  - `busy`: spinner; textarea and button disabled, which prevents duplicate submits
  - `error`: red box (network, AI or server failure)
  - `invalid`: the backend returned 422 → show `DraftEditor`
  - `done`: green "Created 3 projects and 12 tasks" plus the new project cards
- `run(call, label)`: wraps both submit types. It sets `busy`, awaits the call, then sets `done`, `invalid` (via `draftErrorOf`) or `error`. It refuses to run while already busy.
- `loadSample()`: fetches `public/sample-transcript.txt` (the supplied meeting transcript) into the textarea.
- **`DraftEditor`**: the correction form for when the AI's output fails validation.
  - It keeps its own editable copy of the draft. `edit(fn)` deep-copies the draft and applies the change; React needs a new object to notice the update.
  - `issueAt(path)` finds the errors for one field, and `cls(path)` paints that field red.
  - Managers get a dropdown of managers and assignees a dropdown of agents (`PersonSelect`), so you **can't pick someone who isn't in the directory**.
  - "Save corrected projects" calls `api.fromDraft(draft)`, which skips the AI and has the backend validate and save again.
- `Field`: label, input and error text.
- `PersonSelect`: the people dropdown, showing "Unknown: Kamran" when the AI produced someone who isn't in the directory.

---

## 12. Styling: `src/index.css` and `src/assets/icons/`

- `@theme` holds the DashStack design values: `primary-*` (#4880FF blue), `page` (#F5F6FA background), `ink` (text), `line` (borders), and the Nunito Sans font. Tailwind turns these into classes like `bg-primary-600` and `text-ink`.
- Custom classes:
  - `card`: white, 14px rounded corners, soft shadow
  - `btn`: blue DashStack button
  - `field`: form input
- `assets/icons/*.svg`: icons exported from the Figma file (dashboard, todo, chat, team, calendar), used through the `Icon` component.

---

## 13. Two full flows

### Login → seeing projects (Ayesha)
1. Login form → `login()` in `auth.tsx` → `api.login` → `request('POST','/auth/login')` → backend returns `{token, user}`.
2. The token is saved and `user` is set. `/` → `Home` → `/projects`.
3. `Projects` → `api.projects()` → `GET /api/projects` with `Authorization: Bearer …`. **The backend** returns only UrbanCart.
4. Click the card → `/projects/<id>` → `GET /api/projects/<id>` → task table.

### Transcript → saved projects (Admin)
1. Paste or load the transcript and click the button → `run()` → `api.fromTranscript(text)` → `POST /api/transcripts {transcript}`.
2. The backend sends the transcript and directory to the AI, validates the draft, and saves everything in one transaction.
3. The result is one of:
   - **201**: the success view with the cards.
   - **422**: `DraftEditor` → you fix the fields → `POST /api/transcripts {draft}` → 201.
   - **anything else**: an error box. Nothing was saved.

---

## 14. Connecting to the real backend

1. Create `frontend/.env` with `VITE_API_URL=http://localhost:<backend port>` and restart `npm run dev`. The orange mock banner disappears.
2. The backend must:
   - follow `API_CONTRACT.md`: the `/api` prefix, a Bearer token, `{error}` messages, and 422 replies containing `draft` + `issues`
   - allow the frontend's address in its CORS settings, along with the `Authorization` header
3. If the backend differs, e.g. it uses cookies instead of a token, or field names change, the only files to adapt are **`src/api/client.ts`** (`request`) and **`src/types.ts`**. Pages don't change.
4. Test with Ayesha, Ali and Hamza, and try opening another user's project URL directly. It should show "Project not found".

---

## 15. File map

```
frontend/
├── index.html                  page shell, font, root div
├── vite.config.ts              React + Tailwind plugins
├── .env.example                VITE_API_URL, VITE_USE_MOCK
├── public/
│   └── sample-transcript.txt   supplied meeting transcript
└── src/
    ├── main.tsx                mounts <App/>
    ├── App.tsx                 routes + RequireAuth guard
    ├── auth.tsx                AuthProvider / useAuth
    ├── types.ts                shared data shapes (= API_CONTRACT.md)
    ├── index.css               DashStack theme + card/btn/field
    ├── api/
    │   ├── client.ts           request(), api.*, token, errors
    │   └── mock.ts             fake backend for development
    ├── components/
    │   ├── Layout.tsx          sidebar + top bar + <Outlet/>
    │   └── ui.tsx              Icon, StatCard, Spinner, ErrorBox, useLoad, …
    ├── assets/icons/           SVG icons from Figma
    └── pages/
        ├── Login.tsx
        ├── Projects.tsx        + ProjectCard, Stats
        ├── ProjectDetail.tsx   + TaskTable
        ├── MyTasks.tsx
        ├── Team.tsx
        └── CreateFromTranscript.tsx  + DraftEditor, Field, PersonSelect
```
