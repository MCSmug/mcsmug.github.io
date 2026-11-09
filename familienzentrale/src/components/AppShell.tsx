import { CalendarDays, ListChecks, MessageCircle, Settings, ShoppingCart } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useFamily } from '../context/family'

const tabs = [
  { to: '/', label: 'Heute', icon: CalendarDays },
  { to: '/aufgaben', label: 'Aufgaben', icon: ListChecks },
  { to: '/einkauf', label: 'Einkauf', icon: ShoppingCart },
  { to: '/familie', label: 'Familie', icon: MessageCircle },
]

export function AppShell() {
  const { family } = useFamily()

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="font-display text-lg font-semibold">{family.name}</p>
        <NavLink
          to="/einstellungen"
          aria-label="Einstellungen"
          className={({ isActive }) =>
            `flex size-12 items-center justify-center rounded-full ${isActive ? 'bg-ink text-white' : 'text-muted'}`
          }
        >
          <Settings size={22} />
        </NavLink>
      </header>

      <main className="flex-1 px-5 pt-3 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                    isActive ? 'font-semibold text-ink' : 'font-medium text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={24} strokeWidth={isActive ? 2.4 : 1.8} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function PageTitle({ children }: { children: string }) {
  return <h1 className="mb-4 font-display text-3xl font-bold">{children}</h1>
}
