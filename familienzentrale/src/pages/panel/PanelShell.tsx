import { CalendarDays, Settings, ShoppingCart, Star, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useFamily } from '../../context/family'
import { useClock } from '../../hooks/useClock'
import { useWakeLock } from '../../hooks/useWakeLock'
import { toDateInput } from '../../lib/dates'

const tabs = [
  { to: '/panel', label: 'Heute', icon: Sun },
  { to: '/panel/kinder', label: 'Kinder', icon: Star },
  { to: '/panel/woche', label: 'Woche', icon: CalendarDays },
  { to: '/panel/einkauf', label: 'Einkauf', icon: ShoppingCart },
]

const NIGHT_FROM_HOUR = 22
const NIGHT_UNTIL_HOUR = 6

/** Wall panel (tablet in landscape): dark navigation on the left, always on, dimmed at night. */
export function PanelShell() {
  const { family } = useFamily()
  const now = useClock()
  useWakeLock()

  // The panel never gets closed: start every day with fresh data and the latest app version.
  const [startedOn] = useState(() => toDateInput(new Date()))
  useEffect(() => {
    if (toDateInput(now) !== startedOn) window.location.reload()
  }, [now, startedOn])

  const isNight = now.getHours() >= NIGHT_FROM_HOUR || now.getHours() < NIGHT_UNTIL_HOUR

  return (
    <div className="flex h-dvh overflow-hidden">
      <nav aria-label="Wandpanel" className="flex w-48 shrink-0 flex-col gap-2 bg-ink p-3 text-white">
        <p className="px-3 pt-2 pb-4 font-display text-xl leading-tight font-semibold">{family.name}</p>
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/panel'}
            className={({ isActive }) =>
              `flex min-h-16 items-center gap-3 rounded-2xl px-4 text-lg font-semibold ${
                isActive ? 'bg-white text-ink' : 'text-white/80'
              }`
            }
          >
            <Icon size={26} />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/einstellungen"
          className="mt-auto flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm text-white/60"
        >
          <Settings size={20} />
          Zur App
        </NavLink>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>

      {/* Night dimming: darkens the screen but still lets touches through. */}
      {isNight && <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 bg-black/70" />}
    </div>
  )
}
