import { Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { TaskInput } from '../hooks/useTasks'
import { personColor } from '../lib/colors'
import { toDateInput } from '../lib/dates'
import { TASK_ICONS } from '../lib/taskIcons'
import { parseRecurrence, toRecurrence, WEEKDAYS, type Repeat } from '../lib/tasks'
import type { Member, Task } from '../lib/types'
import { Button, ErrorNote, Field, TextInput } from './ui'

interface Props {
  task?: Task
  members: Member[]
  defaultAssigneeId: string
  onSave: (input: TaskInput, id?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onClose: () => void
}

const REPEAT_OPTIONS: { kind: Repeat['kind']; label: string }[] = [
  { kind: 'once', label: 'Einmalig' },
  { kind: 'daily', label: 'Jeden Tag' },
  { kind: 'weekly', label: 'Wochentage' },
]

export function TaskDialog({ task, members, defaultAssigneeId, onSave, onDelete, onClose }: Props) {
  const initialRepeat = parseRecurrence(task?.recurrence ?? null)
  const [title, setTitle] = useState(task?.title ?? '')
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? defaultAssigneeId)
  const [icon, setIcon] = useState<string | null>(task?.icon ?? null)
  const [repeatKind, setRepeatKind] = useState<Repeat['kind']>(initialRepeat.kind)
  const [days, setDays] = useState<string[]>(initialRepeat.kind === 'weekly' ? initialRepeat.days : [])
  const [dueDate, setDueDate] = useState(() => task?.due_date ?? toDateInput(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assignee = members.find((m) => m.id === assigneeId)
  const forChild = assignee?.role === 'child'

  function pickIcon(key: string, label: string) {
    setIcon(icon === key ? null : key)
    // A picture is enough for a kid task: use its name unless the parent typed one.
    if (!title.trim() || TASK_ICONS.some((i) => i.label === title)) setTitle(icon === key ? '' : label)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (repeatKind === 'weekly' && days.length === 0) {
      setError('Bitte mindestens einen Wochentag auswählen.')
      return
    }
    if (forChild && !icon) {
      setError('Bitte ein Bild auswählen – Kinder erkennen ihre Aufgaben am Bild.')
      return
    }
    setBusy(true)
    setError(null)
    const repeat: Repeat = repeatKind === 'weekly' ? { kind: 'weekly', days } : { kind: repeatKind }
    const ok = await onSave(
      {
        assignee_id: assigneeId,
        title: title.trim(),
        icon,
        due_date: dueDate,
        recurrence: toRecurrence(repeat),
        is_kid_task: forChild,
      },
      task?.id,
    )
    setBusy(false)
    if (ok) onClose()
    else setError('Die Aufgabe konnte nicht gespeichert werden.')
  }

  async function remove() {
    if (!task) return
    setBusy(true)
    const ok = await onDelete(task.id)
    setBusy(false)
    if (ok) onClose()
    else setError('Die Aufgabe konnte nicht gelöscht werden.')
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="task-dialog-title" className="font-display text-2xl font-bold">
            {task ? 'Aufgabe' : 'Neue Aufgabe'}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="flex size-12 items-center justify-center rounded-full text-muted"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Für wen?</span>
            <div role="radiogroup" aria-label="Für wen?" className="flex flex-wrap gap-2">
              {members.map((member) => {
                const selected = member.id === assigneeId
                const color = personColor(member.color)
                return (
                  <button
                    key={member.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setAssigneeId(member.id)}
                    className="min-h-12 rounded-2xl border-2 px-4 font-semibold"
                    style={{
                      borderColor: selected ? color.value : 'var(--color-line)',
                      backgroundColor: selected ? color.tint : 'var(--color-card)',
                      color: selected ? color.value : 'var(--color-ink)',
                    }}
                  >
                    {member.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Bild {forChild ? '' : '(optional)'}
            </span>
            <div role="radiogroup" aria-label="Bild" className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              {TASK_ICONS.map(({ key, label, icon: Icon }) => {
                const selected = icon === key
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    title={label}
                    onClick={() => pickIcon(key, label)}
                    className={`flex aspect-square items-center justify-center rounded-2xl border-2 ${
                      selected ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'
                    }`}
                  >
                    <Icon size={26} />
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Was?">
            <TextInput
              required
              maxLength={80}
              placeholder="Müll rausbringen"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Wie oft?</span>
            <div role="radiogroup" aria-label="Wie oft?" className="grid grid-cols-3 gap-2">
              {REPEAT_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  role="radio"
                  aria-checked={repeatKind === option.kind}
                  onClick={() => setRepeatKind(option.kind)}
                  className={`min-h-12 rounded-2xl border px-2 font-semibold ${
                    repeatKind === option.kind ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {repeatKind === 'weekly' && (
            <div role="group" aria-label="Wochentage" className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((day) => {
                const selected = days.includes(day.code)
                return (
                  <button
                    key={day.code}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setDays(selected ? days.filter((d) => d !== day.code) : [...days, day.code])
                    }
                    className={`min-h-12 rounded-2xl border font-semibold ${
                      selected ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          )}

          <Field label={repeatKind === 'once' ? 'Fällig am' : 'Ab wann?'}>
            <TextInput type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex gap-3">
            {task && (
              <Button variant="secondary" onClick={() => void remove()} disabled={busy} aria-label="Aufgabe löschen">
                <Trash2 size={20} />
              </Button>
            )}
            <Button type="submit" disabled={busy || !title.trim()} className="flex-1">
              Speichern
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
