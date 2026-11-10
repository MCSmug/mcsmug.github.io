import { Check, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { TaskIcon } from '../components/TaskIcon'
import { useFamily } from '../context/family'
import { useTasks } from '../hooks/useTasks'
import { personColor } from '../lib/colors'
import { tasksForToday } from '../lib/tasks'

/**
 * Kids' mode: no reading required. Every child has a card in their colour with
 * big picture tiles for today's tasks and a star counter.
 */
export function Kids() {
  const { family, members } = useFamily()
  const children = useMemo(() => members.filter((m) => m.role === 'child'), [members])
  const childIds = useMemo(() => children.map((m) => m.id), [children])
  const { tasks, doneToday, stars, loading, setDone } = useTasks(family.id, childIds)
  const [today] = useState(() => new Date())

  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
      <div className="mb-3 flex justify-end">
        <Link
          to="/aufgaben"
          aria-label="Kindermodus schließen"
          className="flex size-12 items-center justify-center rounded-full text-muted"
        >
          <X size={22} />
        </Link>
      </div>

      {children.length === 0 ? (
        <p className="text-muted">Lege in den Einstellungen zuerst ein Kind an.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {children.map((child) => {
            const color = personColor(child.color)
            const todays = tasksForToday(
              tasks.filter((t) => t.assignee_id === child.id && t.is_kid_task),
              doneToday,
              today,
            )
            const allDone = todays.length > 0 && todays.every((t) => t.done)
            return (
              <section
                key={child.id}
                aria-label={child.name}
                className="rounded-3xl p-4"
                style={{ backgroundColor: color.tint }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-3 font-display text-3xl font-bold" style={{ color: color.value }}>
                    <span
                      aria-hidden="true"
                      className="flex size-14 items-center justify-center rounded-full text-2xl text-white"
                      style={{ backgroundColor: color.value }}
                    >
                      {child.name.trim().charAt(0).toUpperCase()}
                    </span>
                    {child.name}
                  </h2>
                  <p
                    aria-label={`${stars[child.id] ?? 0} Sterne`}
                    className="flex items-center gap-2 rounded-full bg-card px-4 py-2 font-display text-2xl font-bold"
                    style={{ color: color.value }}
                  >
                    <Star size={28} fill="currentColor" />
                    {stars[child.id] ?? 0}
                  </p>
                </div>

                {todays.length === 0 ? (
                  <p className="rounded-3xl bg-card p-6 text-center text-muted">
                    {loading ? 'Lädt …' : 'Heute gibt es keine Aufgaben.'}
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-3">
                    {todays.map(({ task, done }) => {
                      return (
                        <li key={task.id}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={done}
                            aria-label={task.title}
                            onClick={() => void setDone(task, !done)}
                            className="relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-3xl border-4 p-3"
                            style={{
                              borderColor: color.value,
                              backgroundColor: done ? color.value : 'var(--color-card)',
                              color: done ? '#fff' : color.value,
                            }}
                          >
                            <TaskIcon icon={task.icon} className="size-[45%]" strokeWidth={1.75} />
                            <span className="line-clamp-2 text-center text-sm font-semibold">{task.title}</span>
                            {done && (
                              <span
                                className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-card"
                                style={{ color: color.value }}
                              >
                                <Check size={26} strokeWidth={3.5} />
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {allDone && (
                  <p
                    className="mt-4 flex items-center justify-center gap-2 font-display text-xl font-bold"
                    style={{ color: color.value }}
                  >
                    <Star size={24} fill="currentColor" />
                    Alles geschafft
                    <Star size={24} fill="currentColor" />
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
