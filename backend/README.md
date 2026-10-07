# NovaWorks AI Project Manager — backend

Node.js ES modules, Express 5, PostgreSQL, parameterized SQL through pg, bcrypt passwords, PostgreSQL-backed cookie sessions, and a fetch-based LLM adapter. No ORM or frontend code.

Implemented: ten seeded accounts, login/logout/me, team directory, role-scoped project/task views, admin transcript extraction, field-level correction, atomic persistence, concurrent-create protection, and original/modified-transcript verification.

## Run on this machine

PostgreSQL 18.6 is running on port **5432**. The application role `novaworks` owns `novaworks` and `novaworks_test`. Private credentials are already in `backend/.env`. Keep the PostgreSQL service running.

From the repository root:

```sh
cd backend
npm ci
npm run db:init
npm run db:seed
npm start
```

Leave the API terminal running. In another terminal:

```sh
curl --fail http://localhost:4000/api/health
```

For automatic server restarts while editing, use `npm run dev` instead of `npm start`. Do not run both on port 4000.

## Fresh local setup

Prerequisites: Node 22 LTS or newer (minimum 20.10), npm, PostgreSQL 16+ and its psql client, or Docker Compose. Tested locally with Node 26.8.1 and PostgreSQL 18.6.

```sh
cd backend
npm ci
cp .env.example .env
chmod 600 .env
node --input-type=module -e "import {randomBytes} from 'node:crypto'; console.log(randomBytes(48).toString('hex'))"
```

Put the generated value in `SESSION_SECRET`. Set `DATABASE_URL` and `TEST_DATABASE_URL` with the same locally chosen application password and separate database names. Set `LLM_API_KEY`, `LLM_MODEL`, and `CLIENT_URL`. Never share the resulting `.env` or use browser-exposed environment variables for these settings.

For OpenRouter use `LLM_PROVIDER=openai`, `LLM_BASE_URL=https://openrouter.ai/api/v1`, and a supported model ID. This build was verified using `google/gemini-2.5-flash`; the code has no default model.

### Native PostgreSQL

Start the installed PostgreSQL service using your system's service manager. Check its port:

```sh
pg_isready -h 127.0.0.1 -p 5432
psql -X -U postgres -d postgres -c 'SHOW port;'
node scripts/setupLocalDb.js
npm run db:init
npm run db:seed
npm run llm:smoke
npm start
```

`setupLocalDb.js` runs `db/setup-local.sql` through the local `postgres` administrator account. That administrator must be accessible with local authentication or a configured `.pgpass`; the script never embeds its password. It creates only the named project role/databases, and sets the application's password from `.env`. If your server requires operating-system identity `postgres`, run the SQL through your administrator's normal psql workflow with `NW_DATABASE_PASSWORD` set privately. Do not weaken authentication settings.

Database files:

- `db/setup-local.sql`: application role and development/test database creation; idempotent, takes a private password through the environment.
- `db/schema.sql`: idempotent tables, foreign keys, role/hour constraints and indexes.
- `db/reset-work.sql`: removes generated work, preserving accounts and sessions.
- `db/verify.sql`: read-only port, account, project and task verification queries.
- `db/users.json`: fictional demo directory; no real credentials.
- `scripts/seed.js`: parameterized upserts with bcrypt hashes, safe to repeat.

The session table is managed by connect-pg-simple. Password hashes and session contents are never returned by API routes.

### Optional Docker PostgreSQL 16

Docker maps port **5433** by default so it can coexist with native PostgreSQL on 5432. Set both database URLs to port 5433, database/user/password `novaworks`, and test database `novaworks_test`. Then:

```sh
npm run db:up
npm run db:init
npm run db:seed
npm run llm:smoke
npm start
```

Wait for the Docker database to be healthy before initializing. If an existing volume lacks the test database:

```sh
docker compose exec db psql -U novaworks -d novaworks -c 'CREATE DATABASE novaworks_test;'
```

Use `docker compose stop` to stop this database while keeping records. Do not remove the named volume unless you intend to delete its data. Docker is an optional recipe; this machine's verified setup uses native PostgreSQL.

## Frontend integration

Base URL: `http://localhost:4000/api`. Allowed local origins: `http://localhost:3000,http://localhost:5173`. Configure `CLIENT_URL` if the frontend uses a different origin; no wildcard CORS.

```js
const response = await fetch('http://localhost:4000/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const data = await response.json();
```

Use `credentials: 'include'` for every authenticated request. Do not send the role/user ID to choose identity. Keep a loading state during AI calls and disable repeated submit clicks. Read [API.md](docs/API.md) for routes, errors, response shapes, and correction submission. Real captured responses are in [API-examples.json](docs/API-examples.json).

## Demo accounts

All fictional accounts use password `Demo123!` by default. `DEMO_PASSWORD` changes the seed password when the seeder runs.

| Role | Name | Email |
|---|---|---|
| ADMIN | Admin | admin@novaworks.example |
| MANAGER | Ayesha Khan | ayesha@novaworks.example |
| MANAGER | Bilal Ahmed | bilal@novaworks.example |
| MANAGER | Hina Malik | hina@novaworks.example |
| AGENT | Ali Raza | ali@novaworks.example |
| AGENT | Hamza Shah | hamza@novaworks.example |
| AGENT | Sara Noor | sara@novaworks.example |
| AGENT | Usman Tariq | usman@novaworks.example |
| AGENT | Zain Abbas | zain@novaworks.example |
| AGENT | Maryam Asif | maryam@novaworks.example |

## Tests and demo

With the configured databases available:

```sh
npm test
```

Tests use only `TEST_DATABASE_URL`, require a separate database ending in `_test`, run serially, and inject a fake LLM. They do not spend API credits. They reset work in that test database.

Start the API first, then run live verification from another terminal:

```sh
npm run llm:smoke
npm run test:ai
```

`test:ai` makes six real, billable AI requests by default (plus any configured retries), checks all fields for three original and three modified transcripts, and clears projects/tasks in `DATABASE_URL` between runs. It leaves the last modified result in the database. To run one original/changed pair:

```sh
npm run test:ai -- --runs 1
```

`API_URL` defaults to `http://localhost:4000`. Ensure it points to the API using the same `DATABASE_URL`. Remote or production clearing requires `--allow-remote`.

For the actual demo, reset work and paste **all of `fixtures/transcript.txt`**, including its meeting header, into the frontend. Follow [DEMO.md](docs/DEMO.md) for curl equivalents:

```sh
npm run db:reset-work
```

The reset command preserves users and refuses production unless `--force` is given. Seeds and fixtures never run during `npm start`. The development fixture is explicitly marked and forbidden in production; it is not part of the demo workflow. AI output is generated at runtime; the answer key is only used by fixtures/tests.

## Deployment

Status: **local only**; no backend host or hosted database has been provisioned. Optional provider: Aiven PostgreSQL. A working local submission needs a recorded demo video; the delivery teammate must add the video URL, team details, and these setup instructions to the root README.

On a Node host, use `backend/` as the service root, install with `npm ci`, initialize/seed with `npm run db:init && npm run db:seed`, and start with `npm start`. Configure the health check as `/api/health` and supply the environment below through the host's private settings.

Use `NODE_ENV=production`, a long `SESSION_SECRET`, the hosted `DATABASE_URL`, `DATABASE_SSL=true`, and the provider CA in `DATABASE_CA_CERT`. Set `CLIENT_URL` to the deployed frontend's exact origin. Use `COOKIE_SECURE=true`; when frontend and API are on different sites, use `COOKIE_SAMESITE=none`. The application trusts one reverse proxy in production. Same-site hosting is preferable where browsers block third-party cookies.

Verify HTTPS health, browser login, and transcript creation. On a disposable hosted demo database, run `API_URL=https://YOUR_API npm run test:ai -- --allow-remote --runs 1` with matching database configuration. This clears generated hosted work. Check the host's request timeout: one AI attempt can take up to 90 seconds and retries can double that. There is no background-job API.

## Known limitations

- The in-flight lock covers simultaneous `/create` requests for one account within one Node process. Sequential submissions, `/commit`, or multiple server replicas can create duplicates. Run one API instance and disable repeated clicks in the frontend.
- LLM output may vary or the provider may rate-limit; verification records observations, not a guarantee of every future response.
- Only the configured OpenRouter model has been tested live. Anthropic/direct Gemini adapters have stubbed request/error tests.
- Without a configured database CA, TLS falls back to disabled certificate verification with a warning. Supply the CA for verified TLS.
- No login rate limiter, registration, editing of saved work, charts, or user-management endpoints are included.
- Session rows expire for authentication but automatic background pruning is disabled; expired rows can be pruned by database maintenance for longer deployments.
- Hosted deployment and full frontend/browser acceptance require teammates' hosting and frontend work.

## Environment variables

Copy `.env.example`; these names are used by the app and scripts. Never commit actual credentials.

| Name | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `4000` | HTTP port |
| `NODE_ENV` | no | `development` | `production` turns on secure-cookie defaults and `trust proxy` |
| `DATABASE_URL` | **yes** | – | e.g. `postgres://novaworks:novaworks@localhost:5432/novaworks` |
| `TEST_DATABASE_URL` | for tests | – | e.g. `postgres://novaworks:novaworks@localhost:5432/novaworks_test` |
| `DATABASE_SSL` | no | `false` | `true` for Aiven or other hosted Postgres |
| `DATABASE_CA_CERT` | no | – | CA certificate PEM text (literal `\n` allowed). If SSL is on and this is empty, use `rejectUnauthorized: false` and log a warning |
| `SESSION_SECRET` | **yes** | – | long random string; the app refuses to start without it |
| `SESSION_TTL_HOURS` | no | `8` | session lifetime |
| `COOKIE_SECURE` | no | `true` in production, else `false` | cookie `secure` flag |
| `COOKIE_SAMESITE` | no | `lax` | use `none` (with `COOKIE_SECURE=true`) when frontend and API are on different sites |
| `CLIENT_URL` | **yes** | `http://localhost:3000` | comma-separated allowed frontend origins (CORS and Origin check) |
| `LLM_PROVIDER` | **yes** | – | one of `anthropic`, `openai`, `gemini` (`openai` also covers OpenAI-compatible APIs via `LLM_BASE_URL`) |
| `LLM_API_KEY` | **yes** | – | never logged, never committed |
| `LLM_MODEL` | **yes** | – | model name from the provider's current docs; never hard-code a default |
| `LLM_BASE_URL` | no | provider default | for OpenAI-compatible providers |
| `LLM_TEMPERATURE` | no | unset | only sent when set (some models reject it) |
| `LLM_JSON_MODE` | no | `true` | ask for JSON output where the provider supports it; set `false` if the provider rejects the parameter |
| `LLM_MAX_OUTPUT_TOKENS` | no | `8192` | output cap per call |
| `LLM_TIMEOUT_MS` | no | `90000` | per attempt |
| `AI_MAX_ATTEMPTS` | no | `2` | attempts for LLM-call and JSON-parse failures only (not for validation errors) |
| `MEETING_DATE` | no | `2026-10-07` | given to the AI; its year is the only year deadlines may use |
| `TRANSCRIPT_MAX_CHARS` | no | `60000` | reject longer transcripts |
| `DEBUG_AI` | no | `false` | log raw LLM output and the parsed draft (never enable in production) |
| `DEMO_PASSWORD` | no | `Demo123!` | password the seeder gives every demo user |
| `API_URL` | live tests only | `http://localhost:4000` | Running API targeted by test scripts |
| `DB_PORT` | Docker only | `5433` | Host port mapped to optional Docker PostgreSQL |

`NW_DATABASE_PASSWORD` is supplied internally to psql by `setupLocalDb.js`, not stored as another application setting. Native setup reads the password from `DATABASE_URL`.

## Isolated clean-install drill

`node scripts/freshDrill.js` copies this backend into a fresh temporary directory, installs dependencies, and runs initialization, seeding, offline tests and six live AI cases on port 4001. It uses dedicated `novaworks_verify` and `novaworks_verify_test` databases from `db/setup-verification.sql`; it does not reset your demo database or remove Docker volumes. It requires local PostgreSQL administrator access and API credits. The temporary copy has a private `.env`, and verification databases remain available for inspection.

## Final acceptance helpers

After generating the original transcript result, `node scripts/acceptance.js` checks the exact saved work, repeats the seed safely, verifies live restricted views, and stores a private temporary restart snapshot. Restart the API, then run `node scripts/acceptance.js --after-restart` to confirm records and the login session survived. The snapshot is deleted after verification.

`node scripts/checkPersistence.js` copies the current demo records into an isolated temporary PostgreSQL cluster using installed PostgreSQL tools, restarts that cluster, and compares every saved project/task. It leaves the system PostgreSQL service running. Its temporary directory and dump are private to your user.
