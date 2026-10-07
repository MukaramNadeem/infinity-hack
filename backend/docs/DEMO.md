# Backend demo walkthrough

Run commands from `backend/`; keep `npm start` running in another terminal. Use the frontend for the recorded demo; these curl commands provide an equivalent backend walkthrough. Fictional demo password is `Demo123!` unless changed with `DEMO_PASSWORD`.

## Prepare

```sh
npm run db:init
npm run db:seed
npm run db:seed
node scripts/checkDb.js
npm run db:reset-work
curl --fail http://localhost:4000/api/health
```

## Login and create real work

```sh
curl --fail -c /tmp/nw-admin.jar -H 'Content-Type: application/json' \
  -d '{"email":"admin@novaworks.example","password":"Demo123!"}' \
  http://localhost:4000/api/auth/login
node --input-type=module -e "import {readFileSync,writeFileSync} from 'node:fs'; writeFileSync('/tmp/nw-transcript.json', JSON.stringify({transcript:readFileSync('fixtures/transcript.txt','utf8')}))"
curl --fail -b /tmp/nw-admin.jar -H 'Content-Type: application/json' \
  --data-binary @/tmp/nw-transcript.json http://localhost:4000/api/transcript/create
curl --fail -b /tmp/nw-admin.jar http://localhost:4000/api/projects
```

Expect 201 with three projects and twelve tasks. Copy a returned project UUID into the following command:

```sh
curl --fail -b /tmp/nw-admin.jar http://localhost:4000/api/projects/PROJECT_UUID
```

Show client, manager, deadline, task descriptions, owners, hours and dates. Record the QuickServe UUID for the access-denial demonstration.

## Demonstrate restricted views

```sh
curl --fail -c /tmp/nw-ayesha.jar -H 'Content-Type: application/json' \
  -d '{"email":"ayesha@novaworks.example","password":"Demo123!"}' http://localhost:4000/api/auth/login
curl --fail -b /tmp/nw-ayesha.jar http://localhost:4000/api/projects
curl --fail -c /tmp/nw-ali.jar -H 'Content-Type: application/json' \
  -d '{"email":"ali@novaworks.example","password":"Demo123!"}' http://localhost:4000/api/auth/login
curl --fail -b /tmp/nw-ali.jar http://localhost:4000/api/tasks/mine
curl -i -b /tmp/nw-ali.jar http://localhost:4000/api/projects/QUICKSERVE_UUID
curl --fail -c /tmp/nw-hamza.jar -H 'Content-Type: application/json' \
  -d '{"email":"hamza@novaworks.example","password":"Demo123!"}' http://localhost:4000/api/auth/login
curl --fail -b /tmp/nw-hamza.jar http://localhost:4000/api/tasks/mine
```

Ayesha sees her one project. Ali sees three tasks and receives 403 for QuickServe. Hamza sees two tasks across two projects. The team endpoint is readable by every logged-in account.

## Rejection and correction

```sh
curl -i -b /tmp/nw-ayesha.jar -H 'Content-Type: application/json' \
  --data-binary @/tmp/nw-transcript.json http://localhost:4000/api/transcript/create
curl -i -H 'Content-Type: application/json' \
  --data-binary @/tmp/nw-transcript.json http://localhost:4000/api/transcript/create
curl -i -b /tmp/nw-admin.jar -H 'Content-Type: application/json' \
  -d '{"draft":{"projects":[{"name":"Correction example","clientName":"Demo client","description":"Validation example","managerId":"PM01","deadline":"2026-10-20","tasks":[{"title":"Example task","description":"Resolve this assignee","assigneeId":"UNKNOWN","deadline":"2026-10-12","estimatedHours":2}]}]}}' \
  http://localhost:4000/api/transcript/commit
```

Expect manager 403, anonymous 401, and invalid draft 422 with a path/message and normalized draft. Nothing is saved for these cases. To correct a 422, change the flagged field in the returned draft and POST `{ "draft": ... }` to `/commit`.

Offline tests demonstrate simultaneous-create protection and simulated provider/transaction failures without spending credits:

```sh
npm test
```

## Modified transcript and persistence

```sh
npm run test:ai
```

This resets work between cases, then checks three original and three modified inputs. It leaves modified-input data. Reset work and repeat the original create command before recording the standard result.

Restart only the API with Ctrl-C followed by `npm start`, then fetch the project list again: records and valid login sessions persist in PostgreSQL. For the optional project Docker database, `docker compose restart db` verifies database restart persistence. Do not restart a shared native PostgreSQL service during others' work.

The delivery teammate must record the frontend demo if submitting with a local database, and add the video URL and backend instructions to the root README.
