import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LogOut, Menu, X, GraduationCap, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout({ navItems, roleLabel }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const activeItem = navItems.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink-900/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink-900 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-white">ThinkEval</p>
            <p className="mt-1 text-[11px] text-ink-400">{roleLabel}</p>
          </div>
          <button className="ml-auto text-ink-400 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-ink-200 bg-white px-4 py-3.5 lg:px-6">
          <button className="text-ink-500 lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-semibold text-ink-900">{activeItem?.label || roleLabel}</p>
            <p className="hidden text-xs text-ink-400 sm:block">{roleLabel}</p>
          </div>
          <div className="flex-1" />
          <div className="relative">
            <button className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-ink-100" onClick={() => setMenuOpen((v) => !v)}>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none text-ink-800">{user?.name}</p>
                <p className="mt-0.5 text-xs text-ink-400 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-ink-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-ink-200 bg-white py-1 shadow-lg" onMouseLeave={() => setMenuOpen(false)}>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-600 hover:bg-ink-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
