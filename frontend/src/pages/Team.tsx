import { api } from '../api/client'
import { ErrorBox, PageHeader, RoleBadge, Spinner, useLoad } from '../components/ui'
import type { Role } from '../types'

const ORDER: Role[] = ['ADMIN', 'MANAGER', 'AGENT']

export default function Team() {
  const { data, error, loading } = useLoad(api.users)
  const users = [...(data ?? [])].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role))

  return (
    <>
      <PageHeader title="Team Directory" subtitle="NovaWorks Technologies, Lahore." />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <div key={u.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-ink">{u.name}</div>
                <div className="text-sm text-slate-500">{u.specialization}</div>
              </div>
              <RoleBadge role={u.role} />
            </div>
            {u.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {u.skills.map((s) => (
                  <span key={s} className="rounded-[3px] bg-primary-600/15 px-2 py-0.5 text-xs font-semibold text-primary-700">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
