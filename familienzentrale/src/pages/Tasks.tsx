import { Check, Pencil, Plus, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageTitle } from '../components/AppShell'
import { TaskDialog } from '../components/TaskDialog'
import { TaskIcon } from '../components/TaskIcon'
import { Button, Card, ErrorNote } from '../components/ui'
import { useFamily } from '../context/family'
import { useTasks } from '../hooks/useTasks'
import { personColor } from '../lib/colors'
import { fromInputs } from '../lib/dates'
import { describeRecurrence, tasksForToday, upcomingTasks } from '../lib/tasks'
import type { Member, Task } from '../lib/types'

const dueFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })

type DialogState = { task?: Task } | null

function TaskRow({
  task,
  member,
  done,
  detail,
  onToggle,
  onEdit,
}: {
  task: Task
  member: Member | undefined
  done: boolean
  detail: string | null
  onToggle?: () => void
  onEdit: () => void
}) {
  const color = personColor(member?.color)

  return (
    <li className="flex items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        disabled={!onToggle}
        onClick={onToggle}
        className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl py-1 text-left"
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-white"
          style={{ borderColor: color.value, backgroundColor: done ? color.value : 'transparent' }}
        >
          {done && <Check size={18} strokeWidth={3} />}
        </span>
        {task.icon && <TaskIcon icon={task.icon} size={22} className="shrink-0" style={{ color: color.value }} />}
        <span className="min-w-0">
          <span className={`block text-lg ${done ? 'text-muted line-through' : ''}`}>{task.title}</span>
          <span className="block text-sm text-muted">
            {[member?.name, detail].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`${task.title} bearbeiten`}
        onClick={onEdit}
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <Pencil size={18} />
      </button>
    </li>
  )
}

export function Tasks() {
  const { family, me, members } = useFamily()
  const childIds = useMemo(() => members.filter((m) => m.role === 'child').map((m) => m.id), [members])
  const { tasks, doneToday, loading, error, setDone, save, remove } = useTasks(family.id, childIds)
  const [filter, setFilter] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [today] = useState(() => new Date())

  const memberById = new Map(members.map((m) => [m.id, m]))
  const visible = filter ? tasks.filter((t) => t.assignee_id === filter) : tasks
  const todays = tasksForToday(visible, doneToday, today).sort((a, b) => Number(a.done) - Number(b.done))
  const upcoming = upcomingTasks(visible, today)

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageTitle>Aufgaben</PageTitle>
        {childIds.length > 0 && (
          <Link
            to="/kinder"
            className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-card px-4 font-semibold"
          >
            <Star size={18} />
            Kindermodus
          </Link>
        )}
      </div>

      <div role="radiogroup" aria-label="Person" className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {[null, ...members].map((member) => {
          const selected = (member?.id ?? null) === filter
          const color = personColor(member?.color)
          return (
            <button
              key={member?.id ?? 'all'}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setFilter(member?.id ?? null)}
              className="min-h-12 shrink-0 rounded-full border-2 px-4 font-semibold"
              style={
                selected
                  ? { borderColor: color.value, backgroundColor: color.value, color: '#fff' }
                  : { borderColor: 'var(--color-line)', backgroundColor: 'var(--color-card)' }
              }
            >
              {member?.name ?? 'Alle'}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Lädt …</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="py-3">
            <h2 className="font-display text-xl font-semibold">Heute</h2>
            {todays.length === 0 ? (
              <p className="py-2 text-muted">Für heute steht nichts an.</p>
            ) : (
              <ul className="divide-y divide-line">
                {todays.map(({ task, done }) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    member={memberById.get(task.assignee_id)}
                    done={done}
                    detail={describeRecurrence(task.recurrence)}
                    onToggle={() => void setDone(task, !done)}
                    onEdit={() => setDialog({ task })}
                  />
                ))}
              </ul>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card className="py-3">
              <h2 className="font-display text-xl font-semibold">Demnächst</h2>
              <ul className="divide-y divide-line">
                {upcoming.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    member={memberById.get(task.assignee_id)}
                    done={false}
                    detail={dueFormat.format(fromInputs(task.due_date))}
                    onEdit={() => setDialog({ task })}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Button
        aria-label="Neue Aufgabe"
        onClick={() => setDialog({})}
        className="fixed right-5 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 size-16 !rounded-full !px-0 shadow-lg"
      >
        <Plus size={28} />
      </Button>

      {dialog && (
        <TaskDialog
          task={dialog.task}
          members={members}
          defaultAssigneeId={filter ?? me.id}
          onSave={save}
          onDelete={remove}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
