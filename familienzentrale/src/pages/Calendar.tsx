import { Camera, ChevronLeft, ChevronRight, LoaderCircle, Plus } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent } from 'react'

import { EventDialog } from '../components/EventDialog'
import { PhotoImportDialog } from '../components/PhotoImportDialog'
import { WeekGrid } from '../components/WeekGrid'
import { Button, ErrorNote } from '../components/ui'
import { useFamily } from '../context/family'
import { useEvents } from '../hooks/useEvents'
import { personColor } from '../lib/colors'
import { extractEventsFromPhoto, type SuggestedEvent } from '../lib/photoEvents'
import {
  addDays,
  formatTime,
  formatWeekRange,
  formatWeekdayLong,
  isSameDay,
  isoWeek,
  startOfDay,
  startOfWeek,
} from '../lib/dates'
import type { CalendarEvent, Member } from '../lib/types'

type DialogState = { event?: CalendarEvent; date: Date } | null

function eventsOfDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = day.getTime()
  const dayEnd = addDays(day, 1).getTime()
  return events
    .filter((e) => new Date(e.starts_at).getTime() < dayEnd && new Date(e.ends_at).getTime() > dayStart)
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at))
}

function EventChip({
  event,
  member,
  onClick,
}: {
  event: CalendarEvent
  member: Member | undefined
  onClick: () => void
}) {
  const color = personColor(member?.color)
  const time = event.all_day
    ? 'Ganztägig'
    : `${formatTime(new Date(event.starts_at))} – ${formatTime(new Date(event.ends_at))}`

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full flex-col justify-center rounded-2xl px-3 py-2 text-left text-white"
      style={{ backgroundColor: color.value }}
    >
      <span className="text-xs font-medium opacity-90">
        {time}
        {member ? ` · ${member.name}` : ''}
      </span>
      <span className="font-semibold break-words">{event.title}</span>
    </button>
  )
}

export function Calendar() {
  const { family, me, members } = useFamily()
  const [today] = useState(() => startOfDay(new Date()))
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const { events, loading, error, save, saveMany, remove } = useEvents(family.id, weekStart, weekEnd)
  const [dialog, setDialog] = useState<DialogState>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestedEvent[] | null>(null)

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow picking the same photo again
    if (!file) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      setSuggestions(await extractEventsFromPhoto(file))
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Die Foto-Erkennung hat nicht geklappt.')
    }
    setPhotoBusy(false)
  }

  async function savePhotoEvents(inputs: Parameters<typeof saveMany>[0]) {
    const ok = await saveMany(inputs)
    // Jump to the week of the earliest imported event so the result is visible.
    if (ok && inputs.length > 0) {
      const first = inputs.map((i) => i.starts_at).sort()[0]
      setWeekStart(startOfWeek(new Date(first)))
    }
    return ok
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const showsToday = today >= weekStart && today < weekEnd

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="basis-full sm:basis-auto sm:flex-1">
          <h1 className="font-display text-3xl font-bold">Woche {isoWeek(weekStart)}</h1>
          <p className="text-muted">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label="Vorherige Woche"
            className="px-3"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft size={22} />
          </Button>
          <Button variant="secondary" disabled={showsToday} onClick={() => setWeekStart(startOfWeek(today))}>
            Heute
          </Button>
          <Button
            variant="secondary"
            aria-label="Nächste Woche"
            className="px-3"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight size={22} />
          </Button>
        </div>
      </div>

      {(error || photoError) && (
        <div className="mb-4">
          <ErrorNote>{error ?? photoError}</ErrorNote>
        </div>
      )}

      <div className={`grid gap-3 md:hidden ${loading ? 'opacity-60' : ''}`}>
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          const dayEvents = eventsOfDay(events, day)
          return (
            <section
              key={day.getTime()}
              aria-label={formatWeekdayLong(day)}
              className={`flex flex-col gap-2 rounded-3xl border bg-card p-3 ${
                isToday ? 'border-ink' : 'border-line'
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2">
                  <span
                    className={`flex size-10 items-center justify-center rounded-full font-display text-lg font-bold ${
                      isToday ? 'bg-ink text-white' : ''
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <span className="font-semibold">{formatWeekdayLong(day)}</span>
                </h2>
                <button
                  type="button"
                  aria-label={`Termin am ${formatWeekdayLong(day)} hinzufügen`}
                  onClick={() => setDialog({ date: day })}
                  className="flex size-12 items-center justify-center rounded-full text-muted"
                >
                  <Plus size={22} />
                </button>
              </div>

              {dayEvents.map((event) => (
                <EventChip
                  key={event.id}
                  event={event}
                  member={event.member_id ? memberById.get(event.member_id) : undefined}
                  onClick={() => setDialog({ event, date: day })}
                />
              ))}
            </section>
          )
        })}
      </div>

      <div className={`hidden h-[calc(100dvh-15.5rem)] min-h-96 md:block ${loading ? 'opacity-60' : ''}`}>
        <WeekGrid
          days={days}
          events={events}
          memberById={memberById}
          today={today}
          onEventClick={(event, day) => setDialog({ event, date: day })}
          onSlotClick={(start) => setDialog({ date: start })}
          onDayClick={(day) => setDialog({ date: day })}
        />
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPhoto(e)}
      />
      <Button
        variant="secondary"
        aria-label="Termine abfotografieren"
        disabled={photoBusy}
        onClick={() => photoInput.current?.click()}
        className="fixed right-5 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-10 size-16 !rounded-full !px-0 shadow-lg"
      >
        {photoBusy ? <LoaderCircle size={26} className="animate-spin" /> : <Camera size={26} />}
      </Button>
      <Button
        aria-label="Neuer Termin"
        onClick={() => setDialog({ date: showsToday ? today : weekStart })}
        className="fixed right-5 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 size-16 !rounded-full !px-0 shadow-lg"
      >
        <Plus size={28} />
      </Button>

      {suggestions && (
        <PhotoImportDialog
          suggestions={suggestions}
          members={members}
          onSave={savePhotoEvents}
          onClose={() => setSuggestions(null)}
        />
      )}

      {dialog && (
        <EventDialog
          event={dialog.event}
          defaultDate={dialog.date}
          members={members}
          defaultMemberId={me.id}
          onSave={save}
          onDelete={remove}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
