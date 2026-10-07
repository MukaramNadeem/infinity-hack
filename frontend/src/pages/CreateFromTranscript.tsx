import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, draftErrorOf } from '../api/client'
import { ErrorBox, PageHeader, useLoad } from '../components/ui'
import type { Draft, DraftIssue, TranscriptResult, User } from '../types'
import { ProjectCard } from './Projects'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; message: string }
  | { kind: 'invalid'; message: string; draft: Draft; issues: DraftIssue[] }
  | { kind: 'done'; result: TranscriptResult }

const input =
  'w-full rounded-md border px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200'

export default function CreateFromTranscript() {
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const { data: users } = useLoad(api.users)
  const busy = status.kind === 'busy'

  async function run(call: () => Promise<TranscriptResult>, label: string) {
    if (busy) return
    setStatus({ kind: 'busy', label })
    try {
      setStatus({ kind: 'done', result: await call() })
    } catch (err) {
      const invalid = draftErrorOf(err)
      if (invalid) setStatus({ kind: 'invalid', message: (err as Error).message, ...invalid })
      else setStatus({ kind: 'error', message: (err as Error).message })
    }
  }

  async function loadSample() {
    try {
      const res = await fetch('/sample-transcript.txt')
      setTranscript(await res.text())
    } catch {
      setStatus({ kind: 'error', message: 'Could not load the sample transcript.' })
    }
  }

  return (
    <>
      <PageHeader
        title="Create from Transcript"
        subtitle="Paste a meeting transcript. AI extracts the projects and tasks, assigns people from the team directory, and saves them."
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="transcript" className="text-sm font-medium text-slate-700">
            Meeting transcript
          </label>
          <button type="button" onClick={loadSample} disabled={busy} className="text-sm text-primary-600 hover:underline disabled:opacity-50">
            Load supplied transcript
          </button>
        </div>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={busy}
          rows={14}
          placeholder="Paste the meeting transcript here…"
          className="card w-full border border-line p-4 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-slate-100"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => run(() => api.fromTranscript(transcript), 'AI is reading the transcript and creating projects…')}
            disabled={busy || !transcript.trim()}
            className="btn"
          >
            {busy ? 'Processing…' : 'Create from Transcript'}
          </button>
          <span className="text-sm text-slate-500">{transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : ''}</span>
        </div>
      </div>

      <div className="mt-8">
        {status.kind === 'busy' && (
          <div className="flex items-center gap-3 rounded-[14px] bg-primary-50 px-5 py-4 font-semibold text-primary-700">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-300 border-t-primary-700" />
            {status.label}
          </div>
        )}

        {status.kind === 'error' && <ErrorBox message={status.message} />}

        {status.kind === 'done' && (
          <div className="space-y-4">
            <div className="rounded-[14px] bg-[#00b69b]/15 px-5 py-4 text-[#00806d]">
              <span className="font-semibold">
                Created {status.result.projectCount} project{status.result.projectCount === 1 ? '' : 's'} and {status.result.taskCount} task
                {status.result.taskCount === 1 ? '' : 's'}.
              </span>{' '}
              <Link to="/projects" className="underline">
                View all projects
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {status.result.projects.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        )}

        {status.kind === 'invalid' && (
          <DraftEditor
            key={JSON.stringify(status.draft)}
            message={status.message}
            initial={status.draft}
            issues={status.issues}
            users={users ?? []}
            onSubmit={(draft) => run(() => api.fromDraft(draft), 'Validating and saving corrected projects…')}
          />
        )}
      </div>
    </>
  )
}

function DraftEditor({
  message,
  initial,
  issues,
  users,
  onSubmit,
}: {
  message: string
  initial: Draft
  issues: DraftIssue[]
  users: User[]
  onSubmit: (d: Draft) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => structuredClone(initial))
  const managers = users.filter((u) => u.role === 'MANAGER')
  const agents = users.filter((u) => u.role === 'AGENT')
  const issueAt = (path: string) => issues.filter((i) => i.path === path).map((i) => i.message)
  const cls = (path: string) => `${input} ${issueAt(path).length ? 'border-red-400 bg-red-50' : 'border-line'}`

  function edit(fn: (d: Draft) => void) {
    setDraft((d) => {
      const next = structuredClone(d)
      fn(next)
      return next
    })
  }

  // Issues not tied to a specific editable field (e.g. "projects", "projects[0].tasks").
  const general = issues.filter((i) => !/\.(name|clientName|managerId|deadline|title|assigneeId|estimatedHours)$/.test(i.path))

  return (
    <div className="space-y-5">
      <div className="rounded-[14px] bg-[#ffa756]/20 px-5 py-4 text-[#9a5410]">
        <div className="font-semibold">{message || 'Some details need correction. Nothing has been saved yet.'}</div>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
          {issues.map((i, k) => (
            <li key={k}>
              <code className="text-xs">{i.path}</code>: {i.message}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">Fix the highlighted fields below and save again.</p>
      </div>
      {general.length > 0 && <ErrorBox message={general.map((g) => g.message).join(' ')} />}

      {draft.projects.map((p, i) => (
        <div key={i} className="card p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Project name" errors={issueAt(`projects[${i}].name`)}>
              <input className={cls(`projects[${i}].name`)} value={p.name ?? ''} onChange={(e) => edit((d) => (d.projects[i].name = e.target.value))} />
            </Field>
            <Field label="Client" errors={issueAt(`projects[${i}].clientName`)}>
              <input className={cls(`projects[${i}].clientName`)} value={p.clientName ?? ''} onChange={(e) => edit((d) => (d.projects[i].clientName = e.target.value))} />
            </Field>
            <Field label="Manager" errors={issueAt(`projects[${i}].managerId`)}>
              <PersonSelect className={cls(`projects[${i}].managerId`)} value={p.managerId} people={managers} onChange={(v) => edit((d) => (d.projects[i].managerId = v))} />
            </Field>
            <Field label="Deadline" errors={issueAt(`projects[${i}].deadline`)}>
              <input type="date" className={cls(`projects[${i}].deadline`)} value={p.deadline ?? ''} onChange={(e) => edit((d) => (d.projects[i].deadline = e.target.value))} />
            </Field>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-2">Task</th>
                  <th className="pb-2 pr-2">Assignee</th>
                  <th className="pb-2 pr-2">Deadline</th>
                  <th className="w-24 pb-2">Hours</th>
                </tr>
              </thead>
              <tbody>
                {(p.tasks ?? []).map((t, j) => {
                  const at = `projects[${i}].tasks[${j}]`
                  const errs = [...issueAt(`${at}.title`), ...issueAt(`${at}.assigneeId`), ...issueAt(`${at}.deadline`), ...issueAt(`${at}.estimatedHours`)]
                  return (
                    <tr key={j} className="align-top">
                      <td className="py-1 pr-2">
                        <input className={cls(`${at}.title`)} value={t.title ?? ''} onChange={(e) => edit((d) => (d.projects[i].tasks[j].title = e.target.value))} />
                        {errs.length > 0 && <div className="mt-1 text-xs text-red-600">{errs.join(' ')}</div>}
                      </td>
                      <td className="py-1 pr-2">
                        <PersonSelect className={cls(`${at}.assigneeId`)} value={t.assigneeId} people={agents} onChange={(v) => edit((d) => (d.projects[i].tasks[j].assigneeId = v))} />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="date" className={cls(`${at}.deadline`)} value={t.deadline ?? ''} onChange={(e) => edit((d) => (d.projects[i].tasks[j].deadline = e.target.value))} />
                      </td>
                      <td className="py-1">
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          className={cls(`${at}.estimatedHours`)}
                          value={Number.isFinite(t.estimatedHours) ? t.estimatedHours : ''}
                          onChange={(e) => edit((d) => (d.projects[i].tasks[j].estimatedHours = e.target.valueAsNumber))}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <button onClick={() => onSubmit(draft)} className="btn">
        Save corrected projects
      </button>
    </div>
  )
}

function Field({ label, errors, children }: { label: string; errors: string[]; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-500">{label}</span>
      {children}
      {errors.length > 0 && <span className="mt-1 block text-xs text-red-600">{errors.join(' ')}</span>}
    </label>
  )
}

function PersonSelect({ value, people, onChange, className }: { value: string; people: User[]; onChange: (v: string) => void; className: string }) {
  const known = people.some((p) => p.id === value)
  return (
    <select className={className} value={known ? value : ''} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        {value && !known ? `Unknown: ${value}` : 'Select…'}
      </option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.id})
        </option>
      ))}
    </select>
  )
}
