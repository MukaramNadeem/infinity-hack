import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { USE_MOCK } from '../api/client'
import { useAuth } from '../auth'
import chatIcon from '../assets/icons/chat.svg'
import dashboardIcon from '../assets/icons/dashboard.svg'
import teamIcon from '../assets/icons/team.svg'
import todoIcon from '../assets/icons/todo.svg'
import { Icon, RoleBadge } from './ui'

const navItem = ({ isActive }: { isActive: boolean }) =>
  `relative flex items-center gap-3 rounded-md px-4 py-3 whitespace-nowrap text-sm font-semibold tracking-[0.3px] ${
    isActive
      ? 'bg-primary-600 text-white before:absolute before:inset-y-0 before:-left-6 before:w-1 before:rounded-r before:bg-primary-600'
      : 'text-ink hover:bg-page'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const links = [
    { to: '/projects', label: user.role === 'AGENT' ? 'My Projects' : 'Projects', icon: dashboardIcon, show: true },
    { to: '/my-tasks', label: 'My Tasks', icon: todoIcon, show: user.role === 'AGENT' },
    { to: '/transcript', label: 'Import Transcript', icon: chatIcon, show: user.role === 'ADMIN' },
    { to: '/team', label: 'Team', icon: teamIcon, show: true },
  ].filter((l) => l.show)

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-white md:flex">
        <div className="px-6 py-6 text-xl font-extrabold text-ink">
          <span className="text-primary-600">Nova</span>Works
        </div>
        <nav className="flex-1 space-y-1 px-6">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navItem}>
              <Icon src={l.icon} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line/60 px-6 py-4">
          <button onClick={onLogout} className="w-full rounded-md px-5 py-3 text-left text-sm font-semibold text-ink hover:bg-page">
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-white">
          <div className="flex h-[70px] items-center gap-4 px-4 md:px-8">
            <span className="text-lg font-extrabold md:hidden">
              <span className="text-primary-600">Nova</span>Works
            </span>
            <div className="ml-auto flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">
                {user.name.charAt(0)}
              </span>
              <div className="leading-tight">
                <div className="text-sm font-bold text-[#404040]">{user.name}</div>
                <div className="mt-0.5">
                  <RoleBadge role={user.role} />
                </div>
              </div>
              <button onClick={onLogout} className="ml-2 rounded-md border border-line px-3 py-1.5 text-sm md:hidden">
                Logout
              </button>
            </div>
          </div>
          {/* Small screens: the sidebar is hidden, so show the links here */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={(s) => `${navItem(s)} whitespace-nowrap !px-3 !py-2`}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          {USE_MOCK && (
            <div className="bg-[#ffa756]/20 px-4 py-1 text-center text-xs font-semibold text-[#c46a14]">
              Mock API mode: data lives in this browser only. Set VITE_API_URL to use the real backend.
            </div>
          )}
        </header>
        <main className="w-full max-w-6xl px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
