import { X } from 'lucide-react'
import { useState } from 'react'

import type { EventInput } from '../hooks/useEvents'
import { addDays, fromInputs } from '../lib/dates'
import type { SuggestedEvent } from '../lib/photoEvents'
import type { Member } from '../lib/types'
import { Button, ErrorNote, TextInput } from './ui'

interface Row extends SuggestedEvent {
  key: number
  selected: boolean
  memberId: string
}

interface Props {
  suggestions: SuggestedEvent[]
  /** What the recognition saw; shown when no appointments were found. */
  summary: string | null
  members: Member[]
  /** Saves all inputs; returns true on success. */
  onSave: (inputs: EventInput[]) => Promise<boolean>
  onClose: () => void
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Returns null when the row cannot be turned into a valid event. */
function toInput(row: Row): EventInput | null {
  const title = row.title.trim()
  if (!title || !row.date) return null
  const allDay = !row.start_time
  const endTime = row.end_time && row.end_time > (row.start_time ?? '') ? row.end_time : null
  const startsAt = allDay ? fromInputs(row.date) : fromInputs(row.date, row.start_time!)
  const endsAt = allDay
    ? addDays(fromInputs(row.end_date && row.end_date > row.date ? row.end_date : row.date), 1)
    : fromInputs(row.date, endTime ?? addHour(row.start_time!))
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return null
  return {
    title,
    member_id: row.memberId || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    all_day: allDay,
  }
}

export function PhotoImportDialog({ suggestions, summary, members, onSave, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    suggestions.map((s, key) => ({ ...s, key, selected: true, memberId: '' })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const selected = rows.filter((r) => r.selected)

  async function save() {
    const inputs = selected.map(toInput)
    if (inputs.some((i) => i === null)) {
      setError('Bitte bei allen ausgewählten Terminen Titel, Datum und Uhrzeit prüfen.')
      return
    }
    setBusy(true)
    setError(null)
    const ok = await onSave(inputs as EventInput[])
    setBusy(false)
    if (ok) onClose()
    else setError('Die Termine konnten nicht gespeichert werden.')
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-dvh w-full max-w-2xl flex-col rounded-t-3xl bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 id="photo-dialog-title" className="font-display text-2xl font-bold">
            Termine aus dem Foto
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

        {rows.length === 0 ? (
          <div className="py-4 text-muted">
            <p>Auf dem Foto wurden keine Termine erkannt.</p>
            {summary && <p className="mt-2">Erkannt wurde: {summary}</p>}
            <p className="mt-2">
              Tipp: den Zettel gerade und formatfüllend fotografieren, mit gutem Licht und ohne Spiegelung.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Bitte prüfen und bei Bedarf korrigieren – die Erkennung kann sich irren.
            </p>
            <ul className="flex flex-col gap-3 overflow-y-auto">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className={`rounded-3xl border border-line bg-card p-3 ${row.selected ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      aria-label={`${row.title} übernehmen`}
                      checked={row.selected}
                      onChange={(e) => update(row.key, { selected: e.target.checked })}
                      className="size-6 shrink-0 accent-ink"
                    />
                    <TextInput
                      aria-label="Titel"
                      maxLength={120}
                      value={row.title}
                      onChange={(e) => update(row.key, { title: e.target.value })}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <TextInput
                      type="date"
                      aria-label="Datum"
                      value={row.date}
                      onChange={(e) => update(row.key, { date: e.target.value })}
                    />
                    {row.start_time ? (
                      <>
                        <TextInput
                          type="time"
                          aria-label="Von"
                          value={row.start_time}
                          onChange={(e) => update(row.key, { start_time: e.target.value || null })}
                        />
                        <TextInput
                          type="time"
                          aria-label="Bis"
                          value={row.end_time ?? addHour(row.start_time)}
                          onChange={(e) => update(row.key, { end_time: e.target.value || null })}
                        />
                      </>
                    ) : (
                      <>
                        <TextInput
                          type="date"
                          aria-label="Bis Datum"
                          min={row.date}
                          value={row.end_date ?? row.date}
                          onChange={(e) => update(row.key, { end_date: e.target.value || null })}
                        />
                        <span className="flex min-h-12 items-center px-2 text-sm text-muted">Ganztägig</span>
                      </>
                    )}
                    <select
                      aria-label="Für wen?"
                      value={row.memberId}
                      onChange={(e) => update(row.key, { memberId: e.target.value })}
                      className="min-h-12 w-full rounded-2xl border border-line bg-card px-3 text-base"
                    >
                      <option value="">Alle</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && (
          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <div className="mt-4">
          {rows.length === 0 ? (
            <Button onClick={onClose} className="w-full">
              Schließen
            </Button>
          ) : (
            <Button onClick={() => void save()} disabled={busy || selected.length === 0} className="w-full">
              {selected.length === 1 ? '1 Termin übernehmen' : `${selected.length} Termine übernehmen`}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
