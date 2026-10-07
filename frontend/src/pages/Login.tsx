import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ErrorBox } from '../components/ui'

const DEMO_ACCOUNTS = [
  ['Admin', 'admin@novaworks.example'],
  ['Ayesha (Manager)', 'ayesha@novaworks.example'],
  ['Bilal (Manager)', 'bilal@novaworks.example'],
  ['Hina (Manager)', 'hina@novaworks.example'],
  ['Ali (Agent)', 'ali@novaworks.example'],
  ['Hamza (Agent)', 'hamza@novaworks.example'],
  ['Sara (Agent)', 'sara@novaworks.example'],
  ['Usman (Agent)', 'usman@novaworks.example'],
  ['Zain (Agent)', 'zain@novaworks.example'],
  ['Maryam (Agent)', 'maryam@novaworks.example'],
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-600 px-4 py-10">
      <div className="grid w-full max-w-3xl gap-6 md:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-4 card p-8">
          <div>
            <h1 className="text-2xl font-extrabold text-ink"><span className="text-primary-600">Nova</span>Works CRM</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in with your company account.</p>
          </div>
          {error && <ErrorBox message={error} />}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field w-full"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn w-full py-3"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="card p-6 text-sm">
          <h2 className="font-medium text-ink">Demo accounts</h2>
          <p className="mb-3 text-slate-500">
            Password for all: <code className="rounded bg-slate-100 px-1">Demo123!</code>. Click one to fill the form.
          </p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map(([label, mail]) => (
              <li key={mail}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(mail)
                    setPassword('Demo123!')
                  }}
                  className="flex w-full justify-between rounded-md px-2 py-1 text-left hover:bg-slate-100"
                >
                  <span className="text-slate-700">{label}</span>
                  <span className="text-slate-400">{mail}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
