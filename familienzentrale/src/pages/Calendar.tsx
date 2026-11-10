import { Camera, ChevronLeft, ChevronRight, Columns3, List, LoaderCircle, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'

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
  formatWeekdayShort,
  isSameDay,
  isoWeek,
  startOfDay,
  startOfWeek,
} from '../lib/dates'
import type { CalendarEvent, Member } from '../lib/types'

type PhoneView = 'list' | 'week'
const PHONE_VIEW_KEY = 'calendar-phone-view'

function storedPhoneView(): PhoneView {
  try {
    return localStorage.getItem(PHONE_VIEW_KEY) === 'week' ? 'week' : 'list'
  } catch {
    return 'list'
  }
}

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
  // Phones can switch between the day list and the week grid; wide screens always show the grid.
  const [phoneView, setPhoneView] = useState<PhoneView>(storedPhoneView)
  function togglePhoneView() {
    const next = phoneView === 'list' ? 'week' : 'list'
    setPhoneView(next)
    try {
      localStorage.setItem(PHONE_VIEW_KEY, next)
    } catch {
      // Remembering the choice is optional.
    }
  }
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

  // Phone list: jump to a day, and open on today instead of on Monday.
  const dayId = (day: Date) => `day-${day.getTime()}`
  const scrollToDay = (day: Date, smooth = true) =>
    document.getElementById(dayId(day))?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
  const todayTime = today.getTime()
  useEffect(() => {
    if (!loading && showsToday) {
      document.getElementById(`day-${todayTime}`)?.scrollIntoView({ block: 'start' })
    }
    // Only when a week has finished loading, not on every realtime update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, weekStart])

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Woche {isoWeek(weekStart)}</h1>
          <p className="truncate text-sm text-muted sm:text-base">{formatWeekRange(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            aria-label={phoneView === 'list' ? 'Wochenansicht' : 'Listenansicht'}
            className="px-3 md:hidden"
            onClick={togglePhoneView}
          >
            {phoneView === 'list' ? <Columns3 size={22} /> : <List size={22} />}
          </Button>
          <Button
            variant="secondary"
            aria-label="Vorherige Woche"
            className="px-3"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft size={22} />
          </Button>
          <Button
            variant="secondary"
            disabled={showsToday}
            className={showsToday ? 'max-sm:hidden' : ''}
            onClick={() => setWeekStart(startOfWeek(today))}
          >
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

      {/* Phone: week strip to jump between days, then the days as a list */}
      <nav
        aria-label="Wochentage"
        className={`sticky top-0 z-10 -mx-5 mb-3 grid-cols-7 gap-1 bg-bg px-5 py-2 md:hidden ${phoneView === 'list' ? 'grid' : 'hidden'}`}
      >
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          const count = eventsOfDay(events, day).length
          return (
            <button
              key={day.getTime()}
              type="button"
              aria-label={`${formatWeekdayLong(day)}, ${count} Termine`}
              onClick={() => scrollToDay(day)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border ${
                isToday ? 'border-ink bg-ink text-white' : 'border-line bg-card'
              }`}
            >
              <span className="text-[11px] font-semibold uppercase opacity-80">{formatWeekdayShort(day)}</span>
              <span className="font-display text-lg leading-tight font-bold">{day.getDate()}</span>
              <span
                className={`size-1.5 rounded-full ${count === 0 ? 'invisible' : isToday ? 'bg-white' : 'bg-ink'}`}
              />
            </button>
          )
        })}
      </nav>

      <div className={`gap-2 md:hidden ${phoneView === 'list' ? 'grid' : 'hidden'} ${loading ? 'opacity-60' : ''}`}>
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          const dayEvents = eventsOfDay(events, day)
          return (
            <section
              key={day.getTime()}
              id={dayId(day)}
              aria-label={formatWeekdayLong(day)}
              className={`flex scroll-mt-20 flex-col gap-2 rounded-3xl border bg-card px-3 ${
                dayEvents.length > 0 ? 'pb-3' : ''
              } ${isToday ? 'border-ink' : 'border-line'}`}
            >
              <div className="flex items-center justify-between">
                <h2 className={`font-semibold ${dayEvents.length === 0 && !isToday ? 'text-muted' : ''}`}>
                  {formatWeekdayLong(day)}, {day.getDate()}.
                  {dayEvents.length === 0 && <span className="font-normal"> · frei</span>}
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

      <div
        className={`h-[calc(100dvh-18rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-80 md:block md:h-[calc(100dvh-14.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] ${
          phoneView === 'week' ? 'block' : 'hidden'
        } ${loading ? 'opacity-60' : ''}`}
      >
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
