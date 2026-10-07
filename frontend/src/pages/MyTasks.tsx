import { api } from '../api/client'
import { Empty, ErrorBox, PageHeader, Spinner, useLoad } from '../components/ui'
import { TaskTable } from './ProjectDetail'

export default function MyTasks() {
  const { data, error, loading } = useLoad(api.myTasks)
  const tasks = (data ?? [])
    .map((t) => ({ ...t, projectName: t.project.name }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
  const hours = tasks.reduce((s, t) => s + t.estimatedHours, 0)

  return (
    <>
      <PageHeader
        title="My Tasks"
        subtitle={data ? `${tasks.length} assigned task${tasks.length === 1 ? '' : 's'} · ${hours}h estimated` : undefined}
      />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} />}
      {data && tasks.length === 0 && <Empty>No tasks assigned to you yet.</Empty>}
      {tasks.length > 0 && <TaskTable tasks={tasks} showProject />}
    </>
  )
}
