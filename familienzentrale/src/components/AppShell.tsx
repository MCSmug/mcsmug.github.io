import { CalendarDays, ListChecks, MessageCircle, Settings, ShoppingCart } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { useFamily } from '../context/family'
import { OfflineBanner } from './OfflineBanner'

const tabs = [
  { to: '/', label: 'Kalender', icon: CalendarDays },
  { to: '/aufgaben', label: 'Aufgaben', icon: ListChecks },
  { to: '/einkauf', label: 'Einkauf', icon: ShoppingCart },
  { to: '/familie', label: 'Familie', icon: MessageCircle },
]

export function AppShell() {
  const { family } = useFamily()
  // The week calendar uses the full width on tablets and the wall panel.
  const path = useLocation().pathname
  const wide = path === '/'
  // Pages that fill the height themselves and scroll internally (calendar grid, chat).
  const fill = wide || path === '/familie'
  const width = wide ? 'max-w-7xl' : 'max-w-2xl'

  return (
    // The page itself never scrolls: only <main> does, between the fixed-height header and navigation.
    // (A document that scrolls under a position:fixed bar ends up misplaced on iOS after the keyboard closes.)
    <div className="flex h-dvh flex-col overflow-hidden">
      <OfflineBanner />
      <header
        className={`mx-auto flex w-full shrink-0 items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] ${width}`}
      >
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

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Bottom padding keeps the last rows clear of the floating buttons; the calendar handles this itself. */}
        <div className={`mx-auto px-5 pt-3 ${width} ${fill ? `h-full ${wide ? 'md:pb-3' : ''}` : 'pb-28'}`}>
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Hauptnavigation"
        className="shrink-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
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
