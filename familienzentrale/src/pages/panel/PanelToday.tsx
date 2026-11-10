import { Check } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { TaskIcon } from '../../components/TaskIcon'
import { useFamily } from '../../context/family'
import { useClock } from '../../hooks/useClock'
import { useEvents } from '../../hooks/useEvents'
import { useShoppingList } from '../../hooks/useShoppingList'
import { useTasks } from '../../hooks/useTasks'
import { personColor } from '../../lib/colors'
import { addDays, formatTime, startOfDay } from '../../lib/dates'
import { tasksForToday } from '../../lib/tasks'

const dateFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const SHOPPING_PREVIEW = 8

function Column({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-line bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {count && <span className="text-muted">{count}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  )
}

function CheckRow({
  label,
  detail,
  color,
  done,
  icon,
  onToggle,
}: {
  label: string
  detail?: string
  color: string
  done: boolean
  icon?: string | null
  onToggle: () => void
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        className="flex min-h-16 w-full items-center gap-3 text-left"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border-2 text-white"
          style={{ borderColor: color, backgroundColor: done ? color : 'transparent' }}
        >
          {done && <Check size={22} strokeWidth={3} />}
        </span>
        {icon && <TaskIcon icon={icon} size={26} className="shrink-0" style={{ color }} />}
        <span className="min-w-0">
          <span className={`block text-xl ${done ? 'text-muted line-through' : ''}`}>{label}</span>
          {detail && <span className="block text-sm text-muted">{detail}</span>}
        </span>
      </button>
    </li>
  )
}

export function PanelToday() {
  const { family, me, members } = useFamily()
  const now = useClock()
  // The shell reloads the page at midnight, so "today" is fixed for the lifetime of this view.
  const [dayStart] = useState(() => startOfDay(new Date()))
  const dayEnd = useMemo(() => addDays(dayStart, 1), [dayStart])
  const childIds = useMemo(() => members.filter((m) => m.role === 'child').map((m) => m.id), [members])

  const { events } = useEvents(family.id, dayStart, dayEnd)
  const { tasks, doneToday, setDone } = useTasks(family.id, childIds)
  const { items, toggle } = useShoppingList(family.id, me.id)

  const memberById = new Map(members.map((m) => [m.id, m]))
  const todaysEvents = [...events].sort(
    (a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at),
  )
  const todaysTasks = tasksForToday(tasks, doneToday, dayStart).sort((a, b) => Number(a.done) - Number(b.done))
  const openTasks = todaysTasks.filter((t) => !t.done).length
  const openItems = items.filter((i) => !i.done)

  return (
    <div className="flex h-full flex-col gap-5">
      <header className="flex items-baseline gap-5">
        <p className="font-display text-6xl font-bold tabular-nums">{formatTime(now)}</p>
        <p className="text-2xl text-muted">{dateFormat.format(now)}</p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-5">
        <Column title="Termine">
          {todaysEvents.length === 0 ? (
            <p className="text-lg text-muted">Heute steht nichts im Kalender.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {todaysEvents.map((event) => {
                const member = event.member_id ? memberById.get(event.member_id) : undefined
                const ended = !event.all_day && new Date(event.ends_at) <= now
                return (
                  <li
                    key={event.id}
                    className={`rounded-2xl px-4 py-3 text-white ${ended ? 'opacity-50' : ''}`}
                    style={{ backgroundColor: personColor(member?.color).value }}
                  >
                    <p className="text-sm font-medium opacity-90">
                      {event.all_day
                        ? 'Ganztägig'
                        : `${formatTime(new Date(event.starts_at))} – ${formatTime(new Date(event.ends_at))}`}
                      {member ? ` · ${member.name}` : ''}
                    </p>
                    <p className="text-xl font-semibold break-words">{event.title}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </Column>

        <Column title="Aufgaben" count={todaysTasks.length > 0 ? `${openTasks} offen` : undefined}>
          {todaysTasks.length === 0 ? (
            <p className="text-lg text-muted">Für heute steht nichts an.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todaysTasks.map(({ task, done }) => {
                const member = memberById.get(task.assignee_id)
                return (
                  <CheckRow
                    key={task.id}
                    label={task.title}
                    detail={member?.name}
                    color={personColor(member?.color).value}
                    done={done}
                    icon={task.icon}
                    onToggle={() => void setDone(task, !done)}
                  />
                )
              })}
            </ul>
          )}
        </Column>

        <Column title="Einkauf" count={openItems.length > 0 ? `${openItems.length} offen` : undefined}>
          {openItems.length === 0 ? (
            <p className="text-lg text-muted">Die Liste ist leer. Alles da!</p>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {openItems.slice(0, SHOPPING_PREVIEW).map((item) => (
                  <CheckRow
                    key={item.id}
                    label={item.name}
                    color={personColor(item.added_by ? memberById.get(item.added_by)?.color : null).value}
                    done={false}
                    onToggle={() => void toggle(item)}
                  />
                ))}
              </ul>
              {openItems.length > SHOPPING_PREVIEW && (
                <Link to="/panel/einkauf" className="flex min-h-12 items-center text-muted underline">
                  und {openItems.length - SHOPPING_PREVIEW} weitere
                </Link>
              )}
            </>
          )}
        </Column>
      </div>
    </div>
  )
}
