# Verification evidence

Environment: Node 26.8.1, native PostgreSQL 18.6, Asia/Karachi.
Model: google/gemini-2.5-flash through OpenRouter.

## Offline suite

67 tests passed, zero failures. Covers all ten accounts, date round trips, auth, privacy, SQL rollback, concurrent creates, validation V1–V10, adapter failures, and fixture mutation checks.

## Live AI suite

```text
> novaworks-backend@1.0.0 test:ai
> node scripts/testAi.js

PASS original 1/3 (10053ms)
PASS changed 1/3 (7048ms)
PASS original 2/3 (7889ms)
PASS changed 2/3 (7539ms)
PASS original 3/3 (7212ms)
PASS changed 3/3 (7442ms)
AI verification: 6/6 passed (3 original, 3 changed).
```

Expected values live only in fixtures and test/development scripts. Production AI code never imports them.

## Clean-install drill

Fresh temporary directory, npm ci, databases novaworks_verify/novaworks_verify_test, API port 4001. Double initialization and seeding passed; 67 offline tests passed.

```text
PASS original 1/3 (10417ms)
PASS changed 1/3 (7026ms)
PASS original 2/3 (7104ms)
PASS changed 2/3 (7841ms)
PASS original 3/3 (7754ms)
PASS changed 3/3 (8415ms)
AI verification: 6/6 passed (3 original, 3 changed).
CLEAN INSTALL PASS: npm ci, double init/seed, offline tests, health, 3 original + 3 changed AI runs.
```

## Production configuration

69 offline tests now pass, including HTTPS proxy cookie flags, cross-site origin rejection, and CA preservation when a database URL includes SSL query parameters. No hosted deployment was provisioned.

## Final live acceptance

- Original transcript result restored through a fresh real AI call; exact saved work matches the answer key (40/46/38 hours).
- Seeder repeated twice with exactly ten users and unchanged projects/tasks.
- Live Ayesha/Ali/Hamza views verified; Ali's direct QuickServe request returned 403.
- Invalid corrected draft returned 422 and preserved all saved work.
- Database restart passed in an isolated PostgreSQL cluster populated from the actual saved records; all ten users, three projects and twelve tasks survived. The system PostgreSQL service was not interrupted.
- Tracked-file scan found no configured API key, database password, session secret or tracked .env.
- Production fixture and reset guards reject unsafe invocation. Production source contains no answer-key imports or project-specific hardcoding.

- API restart passed: previously issued session remained valid and all project summaries were unchanged.
- Final npm ci reported zero vulnerabilities; final npm test passed 69/69.
- Backend is left running on port 4000 with the original AI-generated demo result.
