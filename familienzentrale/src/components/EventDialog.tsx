import { Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { EventInput } from '../hooks/useEvents'
import { personColor } from '../lib/colors'
import { addDays, fromInputs, toDateInput, toTimeInput } from '../lib/dates'
import type { CalendarEvent, Member } from '../lib/types'
import { Button, ErrorNote, Field, TextInput } from './ui'

interface Props {
  /** Existing event to edit, or undefined for a new one. */
  event?: CalendarEvent
  /** Day preselected for a new event. */
  defaultDate: Date
  members: Member[]
  onSave: (input: EventInput, id?: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
  onClose: () => void
}

function nextFullHour(): string {
  const hour = Math.min(new Date().getHours() + 1, 23)
  return `${String(hour).padStart(2, '0')}:00`
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function EventDialog({ event, defaultDate, members, onSave, onDelete, onClose }: Props) {
  const start = event ? new Date(event.starts_at) : null
  const end = event ? new Date(event.ends_at) : null
  const initialStartTime = start && !event!.all_day ? toTimeInput(start) : nextFullHour()

  const [title, setTitle] = useState(event?.title ?? '')
  const [memberId, setMemberId] = useState<string | null>(event?.member_id ?? null)
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [date, setDate] = useState(toDateInput(start ?? defaultDate))
  // All-day events store an exclusive end, the form shows the last day.
  const [endDate, setEndDate] = useState(
    toDateInput(event?.all_day && end ? addDays(end, -1) : (start ?? defaultDate)),
  )
  const [startTime, setStartTime] = useState(initialStartTime)
  const [endTime, setEndTime] = useState(
    end && !event!.all_day ? toTimeInput(end) : addHour(initialStartTime),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readOnly = event?.source === 'ical'

  async function submit(e: FormEvent) {
    e.preventDefault()
    const startsAt = allDay ? fromInputs(date) : fromInputs(date, startTime)
    const endsAt = allDay ? addDays(fromInputs(endDate < date ? date : endDate), 1) : fromInputs(date, endTime)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      setError('Bitte Datum und Uhrzeit prüfen.')
      return
    }
    if (endsAt <= startsAt) {
      setError('Das Ende muss nach dem Beginn liegen.')
      return
    }
    setBusy(true)
    setError(null)
    const ok = await onSave(
      {
        title: title.trim(),
        member_id: memberId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        all_day: allDay,
      },
      event?.id,
    )
    setBusy(false)
    if (ok) onClose()
    else setError('Der Termin konnte nicht gespeichert werden.')
  }

  async function remove() {
    if (!event) return
    setBusy(true)
    const ok = await onDelete(event.id)
    setBusy(false)
    if (ok) onClose()
    else setError('Der Termin konnte nicht gelöscht werden.')
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="event-dialog-title" className="font-display text-2xl font-bold">
            {event ? 'Termin' : 'Neuer Termin'}
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
          <fieldset disabled={readOnly || busy} className="flex flex-col gap-4">
            <Field label="Was?">
              <TextInput
                required
                maxLength={120}
                autoFocus={!event}
                placeholder="Kinderarzt"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-muted">Für wen?</span>
              <div role="radiogroup" aria-label="Für wen?" className="flex flex-wrap gap-2">
                {[null, ...members].map((member) => {
                  const selected = (member?.id ?? null) === memberId
                  const color = personColor(member?.color)
                  return (
                    <button
                      key={member?.id ?? 'all'}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMemberId(member?.id ?? null)}
                      className="min-h-12 rounded-2xl border-2 px-4 font-semibold"
                      style={{
                        borderColor: selected ? color.value : 'var(--color-line)',
                        backgroundColor: selected ? color.tint : 'var(--color-card)',
                        color: selected ? color.value : 'var(--color-ink)',
                      }}
                    >
                      {member?.name ?? 'Alle'}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="size-6 accent-ink"
              />
              <span className="font-medium">Ganztägig</span>
            </label>

            {allDay ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Von">
                  <TextInput
                    type="date"
                    required
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value)
                      if (endDate < e.target.value) setEndDate(e.target.value)
                    }}
                  />
                </Field>
                <Field label="Bis">
                  <TextInput
                    type="date"
                    required
                    min={date}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Tag">
                  <TextInput type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Von">
                    <TextInput
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value)
                        if (e.target.value) setEndTime(addHour(e.target.value))
                      }}
                    />
                  </Field>
                  <Field label="Bis">
                    <TextInput type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </Field>
                </div>
              </>
            )}
          </fieldset>

          {readOnly && (
            <p className="text-sm text-muted">Dieser Termin kommt aus einem abonnierten Kalender.</p>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}

          {!readOnly && (
            <div className="flex gap-3">
              {event && (
                <Button variant="secondary" onClick={() => void remove()} disabled={busy} aria-label="Termin löschen">
                  <Trash2 size={20} />
                </Button>
              )}
              <Button type="submit" disabled={busy || !title.trim()} className="flex-1">
                Speichern
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
