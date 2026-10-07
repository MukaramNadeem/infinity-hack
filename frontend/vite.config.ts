import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Fixed port: the backend only allows this origin (FRONTEND_URL in backend/.env).
  // strictPort fails loudly instead of silently moving to 5174, which CORS would reject.
  server: { port: 5173, strictPort: true },
})
