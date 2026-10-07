# NovaWorks minimal frontend

A responsive, dependency-free frontend using plain HTML, CSS and JavaScript. Requires Node 22+ and the existing backend.

On a fresh checkout, prepare the local database once:

```sh
cd backend
npm run db:up
npm run db:init
npm run db:seed
```

Start the backend in one terminal:

```sh
cd backend
npm start
```

Start the frontend in another terminal:

```sh
cd frontend
npm start
```

Open **http://localhost:5173**. No dependency installation or build step is needed. `npm run dev` restarts the static server when its code changes; refresh the browser after editing frontend assets.

For a quick demo, choose **Admin** on the sign-in screen (all demo accounts use `Demo123!`). If the backend is not running, the page remains usable as a static shell but API-backed views will show a connection message.

The Node server serves only `public/` and proxies `/api/*` to `http://127.0.0.1:4000`. Set `BACKEND_URL` to change the backend target and `PORT` to change the frontend port. If the frontend origin changes, add it to the backend's `CLIENT_URL`. No API keys or database credentials belong in the frontend.

Features:

- Login, logout and session restoration; demo account shortcuts.
- Searchable role-scoped projects, project details, task owners, deadlines and estimates.
- Developer My Tasks view and read-only team directory.
- Admin transcript submission, optional supplied transcript loading, loading/error/success states.
- Editable validation drafts with manager/assignee selectors, field errors, and corrected-draft submission.
- Responsive layouts, keyboard focus, accessible form labels, and no external assets.

Demo accounts use `Demo123!`: `admin@novaworks.example`, `ayesha@novaworks.example`, `ali@novaworks.example`, `hamza@novaworks.example`. The full directory is in the backend README.

Each successful transcript submission creates new work; use the backend reset script between repeated demos when needed. Role permissions are enforced by the backend. The frontend displays only the records returned by the API and uses HttpOnly session cookies with `credentials: 'include'`.

For production, serve `public/` through your preferred HTTPS host and proxy `/api` to the backend. The included server is intended for local hackathon use.
