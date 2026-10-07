import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import CreateFromTranscript from './pages/CreateFromTranscript'
import Login from './pages/Login'
import MyTasks from './pages/MyTasks'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'
import Team from './pages/Team'
import type { Role } from './types'

function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function Home() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'DEVELOPER' ? '/my-tasks' : '/projects'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="team" element={<Team />} />
            <Route path="my-tasks" element={<RequireAuth roles={['DEVELOPER']}><MyTasks /></RequireAuth>} />
            <Route path="transcript" element={<RequireAuth roles={['ADMIN']}><CreateFromTranscript /></RequireAuth>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
