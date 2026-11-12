import { Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { fromInputs, toDateInput, toTimeInput } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Member, Reminder } from '../lib/types'
import { Button, ErrorNote, Field, TextInput } from './ui'

const whenFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function inOneHour(): Date {
  const date = new Date(Date.now() + 60 * 60 * 1000)
  date.setMinutes(0, 0, 0)
  return date
}

/** Reminders: a push message to the family (or one member) at a chosen time. */
export function ReminderDialog({
  familyId,
  members,
  onClose,
}: {
  familyId: string
  members: Member[]
  onClose: () => void
}) {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [text, setText] = useState('')
  const [initial] = useState(inOneHour)
  const [date, setDate] = useState(() => toDateInput(initial))
  const [time, setTime] = useState(() => toTimeInput(initial))
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('family_id', familyId)
      .is('sent_at', null)
      .order('fire_at')
    if (!error) setReminders(data as Reminder[])
  }, [familyId])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const fireAt = fromInputs(date, time)
    if (Number.isNaN(fireAt.getTime()) || fireAt.getTime() < Date.now()) {
      setError('Der Zeitpunkt muss in der Zukunft liegen.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('reminders').insert({
      family_id: familyId,
      target_member_id: target || null,
      text: text.trim(),
      fire_at: fireAt.toISOString(),
    })
    setBusy(false)
    if (error) {
      setError('Die Erinnerung konnte nicht gespeichert werden.')
      return
    }
    setText('')
    await load()
  }

  async function remove(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id))
    await supabase.from('reminders').delete().eq('id', id)
    await load()
  }

  const memberName = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? '–') : 'Alle')

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 id="reminder-dialog-title" className="font-display text-2xl font-bold">
            Erinnerungen
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
        <p className="mb-4 text-sm text-muted">
          Kommt zur gewählten Zeit als Benachrichtigung auf alle Geräte, auf denen Benachrichtigungen
          eingeschaltet sind.
        </p>

        {reminders.length > 0 && (
          <ul className="mb-4 divide-y divide-line rounded-3xl border border-line bg-card px-4">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex min-h-14 items-center gap-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{reminder.text}</p>
                  <p className="text-sm text-muted">
                    {whenFormat.format(new Date(reminder.fire_at))} · {memberName(reminder.target_member_id)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Erinnerung „${reminder.text}“ löschen`}
                  onClick={() => void remove(reminder.id)}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Woran erinnern?">
            <TextInput
              required
              maxLength={200}
              placeholder="Müll rausstellen"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tag">
              <TextInput type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Uhrzeit">
              <TextInput type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Für wen?">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-card px-3 text-base"
            >
              <option value="">Alle</option>
              {members
                .filter((m) => m.role === 'parent')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy || !text.trim()}>
            Erinnerung anlegen
          </Button>
        </form>
      </div>
    </div>
  )
}
