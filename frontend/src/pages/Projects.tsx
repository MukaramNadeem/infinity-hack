import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth'
import calendarIcon from '../assets/icons/calendar.svg'
import dashboardIcon from '../assets/icons/dashboard.svg'
import todoIcon from '../assets/icons/todo.svg'
import { Empty, ErrorBox, PageHeader, Spinner, StatCard, formatDate, useLoad } from '../components/ui'
import type { ProjectSummary } from '../types'

export function ProjectCard({ p }: { p: ProjectSummary }) {
  return (
    <Link
      to={`/projects/${encodeURIComponent(p.id)}`}
      className="flex flex-col card p-5 transition hover:ring-2 hover:ring-primary-200"
    >
      <h3 className="text-lg font-bold text-ink">{p.name}</h3>
      <p className="text-sm text-slate-500">{p.clientName}</p>
      {p.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-slate-500">Manager</dt>
        <dd className="text-right text-slate-800">{p.manager.name}</dd>
        <dt className="text-slate-500">Deadline</dt>
        <dd className="text-right text-slate-800">{formatDate(p.deadline)}</dd>
        <dt className="text-slate-500">Tasks</dt>
        <dd className="text-right text-slate-800">
          {p.taskCount} · {p.totalHours}h
        </dd>
      </dl>
    </Link>
  )
}

function Stats({ projects, agent }: { projects: ProjectSummary[]; agent: boolean }) {
  const tasks = projects.reduce((s, p) => s + p.taskCount, 0)
  const hours = projects.reduce((s, p) => s + p.totalHours, 0)
  const next = projects.map((p) => p.deadline).sort()[0]
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard label="Projects" value={projects.length} icon={dashboardIcon} tone="text-[#8280ff]" />
      <StatCard label={agent ? 'My tasks' : 'Tasks'} value={tasks} note={`${hours}h estimated`} icon={todoIcon} tone="text-[#fec53d]" />
      <StatCard label="Earliest deadline" value={formatDate(next)} icon={calendarIcon} tone="text-[#4ad991]" />
    </div>
  )
}

export default function Projects() {
  const { user } = useAuth()
  const { data, error, loading } = useLoad(api.projects)

  const subtitle =
    user?.role === 'ADMIN'
      ? 'All company projects.'
      : user?.role === 'MANAGER'
        ? 'Projects you manage.'
        : 'Projects where you have assigned tasks.'

  return (
    <>
      <PageHeader
        title={user?.role === 'AGENT' ? 'My Projects' : 'Projects'}
        subtitle={subtitle}
        action={
          user?.role === 'ADMIN' && (
            <Link to="/transcript" className="btn">
              + Create from Transcript
            </Link>
          )
        }
      />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      {data && data.length === 0 && (
        <Empty>
          {user?.role === 'ADMIN' ? (
            <>
              No projects yet.{' '}
              <Link to="/transcript" className="text-primary-600 underline">
                Create them from a meeting transcript.
              </Link>
            </>
          ) : (
            'No projects assigned to you yet.'
          )}
        </Empty>
      )}
      {data && data.length > 0 && <Stats projects={data} agent={user?.role === 'AGENT'} />}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  )
}
