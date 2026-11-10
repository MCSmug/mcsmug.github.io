import { Camera, ChevronLeft, ChevronRight, LoaderCircle, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'

import { EventDialog } from '../components/EventDialog'
import { PhotoImportDialog } from '../components/PhotoImportDialog'
import { WeekGrid } from '../components/WeekGrid'
import { Button, ErrorNote } from '../components/ui'
import { useFamily } from '../context/family'
import { useEvents } from '../hooks/useEvents'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { personColor } from '../lib/colors'
import { extractEventsFromPhoto, type PhotoResult } from '../lib/photoEvents'
import {
  addDays,
  formatDayRangeShort,
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

const PHONE_VIEWS = [
  { key: 'list', label: 'Liste' },
  { key: 'days3', label: '3 Tage' },
  { key: 'week', label: 'Woche' },
] as const
type PhoneView = (typeof PHONE_VIEWS)[number]['key']
const PHONE_VIEW_KEY = 'calendar-phone-view'

function storedPhoneView(): PhoneView {
  try {
    const stored = localStorage.getItem(PHONE_VIEW_KEY)
    return PHONE_VIEWS.find((v) => v.key === stored)?.key ?? 'list'
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

/** `inPanel`: rendered inside the wall panel, which has its own navigation and no bottom bar. */
export function Calendar({ inPanel = false }: { inPanel?: boolean }) {
  const { family, me, members } = useFamily()
  const [today] = useState(() => startOfDay(new Date()))
  // The day the view is built around: its week, or the three days starting with it.
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  // Phones can switch between day list, three days and the week grid; wide screens always show the week grid.
  const isWide = useMediaQuery('(min-width: 768px)')
  const [phoneView, setPhoneView] = useState<PhoneView>(storedPhoneView)
  const threeDays = !isWide && phoneView === 'days3'
  const showGrid = isWide || phoneView !== 'list'
  const step = threeDays ? 3 : 7
  // Three days starting late in the week reach into the next one.
  const rangeEnd = useMemo(() => {
    const end = addDays(anchor, 3)
    return end > weekEnd ? end : weekEnd
  }, [anchor, weekEnd])
  const { events, loading, error, save, saveMany, remove } = useEvents(family.id, weekStart, rangeEnd)
  const [dialog, setDialog] = useState<DialogState>(null)
  function choosePhoneView(next: PhoneView) {
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
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null)

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow picking the same photo again
    if (!file) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      setPhotoResult(await extractEventsFromPhoto(file))
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
      setAnchor(startOfDay(new Date(first)))
    }
    return ok
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const gridDays = threeDays ? Array.from({ length: 3 }, (_, i) => addDays(anchor, i)) : days
  const memberById = new Map(members.map((m) => [m.id, m]))
  const showsToday = threeDays
    ? today >= anchor && today < addDays(anchor, 3)
    : today >= weekStart && today < weekEnd

  // Phone list: jump to a day, and open on today instead of on Monday.
  const dayId = (day: Date) => `day-${day.getTime()}`
  const scrollToDay = (day: Date, smooth = true) =>
    document
      .getElementById(dayId(day))
      ?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
  const todayTime = today.getTime()
  useEffect(() => {
    if (!loading && showsToday) {
      document.getElementById(`day-${todayTime}`)?.scrollIntoView({ block: 'start' })
    }
    // Only when a week has finished loading, not on every realtime update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, weekStart])

  return (
    // With the grid the page fills the available height exactly; the list simply grows and scrolls.
    <div className={showGrid ? 'flex h-full flex-col' : 'pb-24'}>
      <div className="mb-3 flex shrink-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold sm:text-3xl">
            {threeDays ? (
              formatDayRangeShort(anchor, addDays(anchor, 2))
            ) : (
              <>
                <span className="sm:hidden">KW</span>
                <span className="max-sm:hidden">Woche</span> {isoWeek(weekStart)}
              </>
            )}
          </h1>
          {!threeDays && (
            <p className="truncate text-sm text-muted sm:text-base">{formatWeekRange(weekStart)}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="secondary"
            aria-label="Zurück"
            className="!px-3"
            onClick={() => setAnchor(addDays(anchor, -step))}
          >
            <ChevronLeft size={22} />
          </Button>
          <Button
            variant="secondary"
            disabled={showsToday}
            className={`max-sm:!px-3 ${showsToday ? 'max-sm:hidden' : ''}`}
            onClick={() => setAnchor(today)}
          >
            Heute
          </Button>
          <Button
            variant="secondary"
            aria-label="Weiter"
            className="!px-3"
            onClick={() => setAnchor(addDays(anchor, step))}
          >
            <ChevronRight size={22} />
          </Button>
        </div>
      </div>

      {!isWide && (
        <div
          role="radiogroup"
          aria-label="Ansicht"
          className="mb-3 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-card p-1"
        >
          {PHONE_VIEWS.map((view) => (
            <button
              key={view.key}
              type="button"
              role="radio"
              aria-checked={phoneView === view.key}
              onClick={() => choosePhoneView(view.key)}
              className={`min-h-11 rounded-xl text-sm font-semibold ${
                phoneView === view.key ? 'bg-ink text-white' : 'text-ink'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      )}

      {photoBusy && (
        <p role="status" className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 font-medium">
          <LoaderCircle size={22} className="shrink-0 animate-spin" />
          Foto wird ausgewertet … das dauert bis zu einer halben Minute.
        </p>
      )}

      {(error || photoError) && (
        <div className="mb-4">
          <ErrorNote>{error ?? photoError}</ErrorNote>
        </div>
      )}

      {/* Phone list view: week strip to jump between days, then the days as a list */}
      {!showGrid && (
        <>
          <nav
            aria-label="Wochentage"
            className="sticky top-0 z-10 -mx-5 mb-3 grid grid-cols-7 gap-1 bg-bg px-5 py-2"
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
                  <span className="text-[11px] font-semibold uppercase opacity-80">
                    {formatWeekdayShort(day)}
                  </span>
                  <span className="font-display text-lg leading-tight font-bold">{day.getDate()}</span>
                  <span
                    className={`size-1.5 rounded-full ${count === 0 ? 'invisible' : isToday ? 'bg-white' : 'bg-ink'}`}
                  />
                </button>
              )
            })}
          </nav>

          <div className={`grid gap-2 ${loading ? 'opacity-60' : ''}`}>
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
        </>
      )}

      {showGrid && (
        <div className={`min-h-64 flex-1 ${loading ? 'opacity-60' : ''}`}>
          <WeekGrid
            days={gridDays}
            events={events}
            memberById={memberById}
            today={today}
            onEventClick={(event, day) => setDialog({ event, date: day })}
            onSlotClick={(start) => setDialog({ date: start })}
            onDayClick={(day) => setDialog({ date: day })}
          />
        </div>
      )}

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
        className={`fixed right-5 z-10 size-16 !rounded-full !px-0 shadow-lg ${
          inPanel ? 'bottom-[6.25rem]' : 'bottom-[calc(10rem+env(safe-area-inset-bottom))]'
        }`}
      >
        {photoBusy ? <LoaderCircle size={26} className="animate-spin" /> : <Camera size={26} />}
      </Button>
      <Button
        aria-label="Neuer Termin"
        onClick={() => setDialog({ date: showsToday ? today : threeDays ? anchor : weekStart })}
        className={`fixed right-5 z-10 size-16 !rounded-full !px-0 shadow-lg ${
          inPanel ? 'bottom-6' : 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <Plus size={28} />
      </Button>

      {photoResult && (
        <PhotoImportDialog
          suggestions={photoResult.events}
          summary={photoResult.summary}
          members={members}
          onSave={savePhotoEvents}
          onClose={() => setPhotoResult(null)}
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
    </div>
  )
}
