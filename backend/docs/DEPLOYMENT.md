# Deployment readiness

Deployment is **not performed**: no host account, hosted database, or deployed frontend origin was supplied. Local functionality and production configuration are tested; the hosted browser gate remains unverified.

Use a Node service with `backend/` as its root:

| Setting | Value |
|---|---|
| Node | 22 LTS or compatible newer runtime |
| Build | `npm ci` |
| Release/setup | `npm run db:init && npm run db:seed` |
| Start | `npm start` |
| Health | `/api/health` |
| Replicas | 1, because transcript in-flight locks are process-local |

Provision a PostgreSQL database (Aiven is the challenge's suggested provider) and put its credentials in the host's private environment. Use `DATABASE_SSL=true` and the provider CA in `DATABASE_CA_CERT` (PEM text, literal `\n` accepted). URL SSL query parameters are removed so they cannot override these explicit SSL settings. Without a CA, the app logs a warning and disables certificate verification as specified by the brief.

Set a new `SESSION_SECRET`, `NODE_ENV=production`, `COOKIE_SECURE=true`, the actual `CLIENT_URL`, and the LLM settings. Set `COOKIE_SAMESITE=none` for cross-site frontend/API hosts. The app trusts one reverse proxy. Use same-site hosting where browser third-party cookie policies prevent cross-site sessions.

Check the host's HTTP timeout before deploying the synchronous AI endpoint; configured worst-case AI latency is `AI_MAX_ATTEMPTS * LLM_TIMEOUT_MS` plus database work. A shorter host timeout requires a longer-timeout service or a separately coordinated asynchronous API contract change.

After deployment, verify HTTPS health and a real browser's login/session/transcript flow from the allowed frontend origin. Run the live test only against a disposable demo database with `API_URL` and `DATABASE_URL` pointing to the same deployment:

```sh
npm run test:ai -- --allow-remote --runs 1
```

This clears generated projects/tasks. Do not use it against valuable saved work. Record the live URL and final deployed commit in the root submission README through the delivery teammate.
