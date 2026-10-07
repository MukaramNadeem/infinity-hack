import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'
import { ErrorBox, Spinner, formatDate, useLoad } from '../components/ui'
import type { Task } from '../types'

export function TaskTable({ tasks, showProject }: { tasks: (Task & { projectName?: string })[]; showProject?: boolean }) {
  return (
    <div className="overflow-x-auto card">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#f1f4f9] text-xs font-bold uppercase tracking-wide text-ink">
          <tr>
            <th className="px-4 py-3">Task</th>
            {showProject && <th className="px-4 py-3">Project</th>}
            <th className="px-4 py-3">Assigned to</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3 text-right">Est. hours</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <tr key={t.id} className="align-top">
              <td className="px-4 py-3">
                <div className="font-semibold text-ink">{t.title}</div>
                {t.description && <div className="mt-0.5 text-slate-500">{t.description}</div>}
              </td>
              {showProject && (
                <td className="px-4 py-3">
                  <Link to={`/projects/${encodeURIComponent(t.projectId)}`} className="text-primary-600 hover:underline">
                    {t.projectName}
                  </Link>
                </td>
              )}
              <td className="whitespace-nowrap px-4 py-3">{t.assignee.name}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(t.deadline)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{t.estimatedHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ProjectDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { data: p, error, loading } = useLoad(() => api.project(id), [id])

  if (loading) return <Spinner />
  if (error || !p) {
    return (
      <div className="space-y-4">
        <ErrorBox message={error ?? 'Project not found.'} />
        <Link to="/projects" className="text-sm text-primary-600 hover:underline">
          ← Back to projects
        </Link>
      </div>
    )
  }

  return (
    <>
      <Link to="/projects" className="text-sm text-primary-600 hover:underline">
        ← Back to projects
      </Link>
      <div className="mb-6 mt-3 card p-6">
        <h1 className="text-2xl font-bold text-ink">{p.name}</h1>
        {p.description && <p className="mt-2 max-w-3xl text-slate-600">{p.description}</p>}
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Client</dt>
            <dd className="font-medium text-ink">{p.clientName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Manager</dt>
            <dd className="font-medium text-ink">{p.manager.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Deadline</dt>
            <dd className="font-medium text-ink">{formatDate(p.deadline)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{user?.role === 'AGENT' ? 'Your tasks' : 'Tasks'}</dt>
            <dd className="font-medium text-ink">
              {p.tasks.length} · {p.tasks.reduce((s, t) => s + t.estimatedHours, 0)}h
            </dd>
          </div>
        </dl>
      </div>
      <h2 className="mb-3 text-lg font-semibold text-ink">
        {user?.role === 'AGENT' ? 'Your tasks in this project' : 'Tasks'}
      </h2>
      {p.tasks.length ? <TaskTable tasks={p.tasks} /> : <p className="text-slate-500">No tasks.</p>}
    </>
  )
}
