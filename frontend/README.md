# NovaWorks CRM — Frontend

React 19 + Vite + TypeScript + Tailwind v4 + React Router.

```sh
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL to the backend, e.g. http://localhost:4000
npm run dev               # http://localhost:5173
```

- With `VITE_API_URL` empty (or `VITE_USE_MOCK=true`) the app runs against an in-browser
  mock API (`src/api/mock.ts`) that follows `../API_CONTRACT.md`. The mock's "AI" returns the
  reference answer; put the word `INVALID` in the transcript to test the correction screen.
  Clear the browser's localStorage to reset mock data.
- Auth token is stored in localStorage and sent as `Authorization: Bearer <token>`.
- `public/sample-transcript.txt` is the supplied meeting transcript ("Load supplied transcript" button).
- Production build: `npm run build` → `dist/` (static; on Vercel/Netlify add an SPA rewrite to `index.html`).
