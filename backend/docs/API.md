# NovaWorks Backend API



**Conventions**

- Base path `/api`. JSON requests and responses. Dates are `YYYY-MM-DD` strings.
- Auth is a session cookie named `nw.sid` (httpOnly). The frontend must send credentials (`fetch(url, { credentials: 'include' })`). CORS allows only the origins in `CLIENT_URL`.
- Every error has the same shape. `message` is always human-readable and safe to show in the UI; `details` appears only for validation errors.

```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have access to this project." } }
```

| Code | HTTP | When |
|---|---|---|
| `BAD_REQUEST` | 400 | Missing or malformed body fields |
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `EMPTY_TRANSCRIPT` | 400 | Transcript is empty or whitespace |
| `UNAUTHENTICATED` | 401 | No valid session |
| `INVALID_CREDENTIALS` | 401 | Unknown email or wrong password (same response for both) |
| `FORBIDDEN` | 403 | Wrong role, project outside the caller's scope, or blocked Origin |
| `NOT_FOUND` | 404 | Unknown route or project id |
| `ALREADY_PROCESSING` | 409 | A transcript creation is already running for this user |
| `TRANSCRIPT_TOO_LONG` | 413 | Longer than `TRANSCRIPT_MAX_CHARS` |
| `VALIDATION_FAILED` | 422 | Draft has unresolved or invalid fields; nothing was saved |
| `AI_FAILED` | 502 | Provider error, network error, or unparseable output after all attempts |
| `AI_BUSY` | 503 | Provider rate limit or overload |
| `AI_TIMEOUT` | 504 | The LLM call exceeded `LLM_TIMEOUT_MS` |
| `INTERNAL` | 500 | Anything else (details logged server-side only) |

AI error messages must be friendly and must say that nothing was saved, e.g. "The AI service is busy. Please try again in a moment. Nothing was saved."

**Shapes**

- `User`: `{ id, name, email, role, specialization }`
- `TeamMember`: `{ id, name, role, specialization, skills }`
- `ProjectSummary`: `{ id, name, clientName, description, deadline, manager: { id, name }, taskCount, totalEstimatedHours }` — the counts cover only the tasks the caller may see
- `Task`: `{ id, projectId, title, description, deadline, estimatedHours, assignee: { id, name, specialization } }`

**Endpoints**

| Method and path | Who | Success | Notes |
|---|---|---|---|
| `GET /api/health` | public | `200 { ok: true, db: "up" }` | `503 { ok: false, db: "down" }` if the DB is unreachable |
| `POST /api/auth/login` | public | `200 { user }` + cookie | body `{ email, password }`; regenerate the session on login |
| `POST /api/auth/logout` | any | `204` | destroys the session and clears the cookie |
| `GET /api/auth/me` | logged in | `200 { user }` | `401` without a valid session |
| `GET /api/team` | logged in | `200 { team: TeamMember[] }` | read-only directory of all ten accounts, ordered by id |
| `GET /api/projects` | logged in | `200 { projects: ProjectSummary[] }` | scoped by role (§9); ordered by deadline, then name |
| `GET /api/projects/:id` | logged in | `200 { project: ProjectSummary, tasks: Task[] }` | `403` outside the caller's scope, `404` if it doesn't exist; tasks ordered by deadline, then title |
| `GET /api/projects/:id/tasks` | logged in | `200 { tasks: Task[] }` | same rules as above |
| `GET /api/tasks/mine` | logged in | `200 { tasks: (Task & { project })[] }` | tasks assigned to the caller (empty for non-agents); `project` is `{ id, name, clientName, deadline, manager: { id, name } }`; ordered by deadline |
| `POST /api/transcript/create` | ADMIN | `201 { result }` | body `{ transcript }` — runs the AI pipeline (§10) |
| `POST /api/transcript/commit` | ADMIN | `201 { result }` | body `{ draft }` — a corrected draft, validated and saved exactly like an AI draft |

Out-of-scope projects return **403** (not 404) so the demo visibly shows the rejection. Ids are random UUIDs, so leaking existence is not a concern.

**`create` and `commit`**

Order of checks: session (401) → role (403) → body (400/413) → in-flight lock (409, `create` only) → AI call (502/503/504, `create` only) → validation (422) → save (201).

Success:

```json
{
  "result": {
    "projectCount": 3,
    "taskCount": 12,
    "projects": [
      { "id": "<uuid>", "name": "UrbanCart Website", "clientName": "UrbanCart Clothing",
        "managerId": "PM01", "deadline": "2026-10-20", "taskCount": 4 }
    ]
  }
}
```

Validation failure (nothing saved). `draft` is the normalised draft so the UI can show it, let the admin fix the flagged fields, and re-submit it to `/commit`:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The draft has unresolved fields. Nothing was saved.",
    "details": [
      { "path": "projects[2].tasks[1].assigneeId", "message": "Assignee could not be determined from the transcript." }
    ]
  },
  "draft": { "projects": [] }
}
```


## Frontend behavior

- Use `credentials: 'include'` on login and all subsequent requests; cookie name is `nw.sid`, HttpOnly.
- Configured local origins are `http://localhost:3000` and `http://localhost:5173`. Production origins must be configured explicitly.
- Show `error.message` for failures. For 422 responses, retain the returned top-level `draft`, highlight each `error.details[].path`, edit the draft, then POST `{ draft }` to `/api/transcript/commit`.
- Dates stay `YYYY-MM-DD` strings. Format them without converting through UTC/local midnight.
- `taskCount` and `totalEstimatedHours` include only tasks visible to the session user.
- Disable submission while `/create` is pending; 409 means an operation is already running. A successful repeat after completion creates another set of work.
- No update/delete/seed/reset endpoints exist. Management scripts run locally.

## Captured responses

See [API-examples.json](API-examples.json), captured from an actual authenticated live LLM run. IDs identify that run and may change after resets.

## Provider references

Request formats checked against [OpenRouter](https://openrouter.ai/docs/api_reference/overview), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), and [Gemini generateContent](https://ai.google.dev/api/generate-content). The configured OpenRouter model passed the live smoke and transcript checks; other adapters were tested with stubbed fetch.
