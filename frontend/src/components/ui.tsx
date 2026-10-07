import { useEffect, useState, type ReactNode } from 'react'
import type { Role } from '../types'

export function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** DashStack icon (SVG used as a mask), drawn in the current text colour. */
export function Icon({ src, className = 'size-6' }: { src: string; className?: string }) {
  const mask = `url("${src}") center / contain no-repeat`
  return <span aria-hidden className={`${className} shrink-0 bg-current`} style={{ mask, WebkitMask: mask }} />
}

/** Dashboard stat card: label, big value, tinted icon square (colour = text-[...] class). */
export function StatCard({ label, value, note, icon, tone }: { label: string; value: ReactNode; note?: string; icon: string; tone: string }) {
  return (
    <div className="card flex items-start justify-between gap-4 p-5">
      <div>
        <div className="text-sm font-semibold text-slate-500">{label}</div>
        <div className="mt-3 text-[28px] leading-none font-bold tracking-wide text-ink">{value}</div>
        {note && <div className="mt-3 text-sm text-slate-500">{note}</div>}
      </div>
      <span className={`relative flex size-14 shrink-0 items-center justify-center rounded-[20px] ${tone}`}>
        <span className="absolute size-14 rounded-[20px] bg-current opacity-20" />
        <Icon src={icon} className="size-7" />
      </span>
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-primary-600" />
      {label}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md bg-[#ef3826]/15 px-4 py-3 text-sm font-semibold text-[#c42514]">
      {message}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center text-slate-500">
      {children}
    </div>
  )
}

// DashStack label colours (text colour + same colour at 20% for the background)
const roleStyles: Record<Role, string> = {
  ADMIN: 'bg-[#6226ef]/20 text-[#6226ef]',
  MANAGER: 'bg-[#4880ff]/20 text-[#4880ff]',
  DEVELOPER: 'bg-[#00b69b]/20 text-[#00b69b]',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`rounded-[4.5px] px-2.5 py-1 text-xs font-bold ${roleStyles[role]}`}>
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </span>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Minimal data-loading hook: runs `fn` on mount / when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fn()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}
