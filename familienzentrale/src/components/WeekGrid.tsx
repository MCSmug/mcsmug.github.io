import { useEffect, useRef, useState, type MouseEvent } from 'react'

import { personColor } from '../lib/colors'
import { addDays, formatTime, formatWeekdayLong, formatWeekdayShort, isSameDay } from '../lib/dates'
import type { CalendarEvent, Member } from '../lib/types'

// The grid shows this part of the day without scrolling; the rest is reachable by scrolling.
const VISIBLE_FROM_HOUR = 7
const VISIBLE_HOURS = 14
// Phones show fewer hours at once so the rows are tall enough for readable text.
const VISIBLE_HOURS_NARROW = 9
const NARROW_WIDTH = 640
// Below this column width overlapping events are stacked with an offset instead of side by side.
const NARROW_COLUMN = 80
const CASCADE_STEP = 0.3
const MIN_HOUR_HEIGHT = 36
const DEFAULT_HOUR_HEIGHT = 52
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MIN_VISUAL_MINUTES = 30
const DAY_MINUTES = 24 * 60

interface Props {
  days: Date[]
  events: CalendarEvent[]
  memberById: Map<string, Member>
  today: Date
  onEventClick: (event: CalendarEvent, day: Date) => void
  /** Called with the clicked day and time (rounded to half hours). */
  onSlotClick: (start: Date) => void
  onDayClick: (day: Date) => void
}

interface Placed {
  event: CalendarEvent
  start: number // minutes since midnight of this day
  end: number
  column: number
  columns: number
}

const duration = (e: CalendarEvent) => new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()
/** Shown in the top row instead of the time grid. */
const isAllDayLike = (e: CalendarEvent) => e.all_day || duration(e) >= DAY_MINUTES * 60_000

function overlapsDay(e: CalendarEvent, day: Date) {
  return new Date(e.starts_at) < addDays(day, 1) && new Date(e.ends_at) > day
}

/** Places the timed events of one day side by side where they overlap. */
function layoutDay(events: CalendarEvent[], day: Date): Placed[] {
  const dayStart = day.getTime()
  const items = events
    .filter((e) => !isAllDayLike(e) && overlapsDay(e, day))
    .map((event) => {
      const start = Math.max(0, (new Date(event.starts_at).getTime() - dayStart) / 60_000)
      const end = Math.min(DAY_MINUTES, (new Date(event.ends_at).getTime() - dayStart) / 60_000)
      return { event, start, end: Math.max(end, start + MIN_VISUAL_MINUTES), column: 0, columns: 1 }
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)

  let cluster: Placed[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1
  const close = () => cluster.forEach((p) => (p.columns = columnEnds.length))

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      close()
      cluster = []
      columnEnds = []
    }
    let column = columnEnds.findIndex((end) => end <= item.start)
    if (column === -1) column = columnEnds.length
    columnEnds[column] = item.end
    item.column = column
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  close()
  return items
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function WeekGrid({ days, events, memberById, today, onEventClick, onSlotClick, onDayClick }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const now = useNow()

  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT)
  // False while the grid is hidden (phone list view); scrolling only works once it is shown.
  const [shown, setShown] = useState(false)
  const [narrowColumns, setNarrowColumns] = useState(false)
  const dayCount = days.length

  // Size the hours so that the usual part of the day fills the available height.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const measure = () => {
      setShown(element.clientHeight > 0)
      setNarrowColumns(element.clientWidth / dayCount < NARROW_COLUMN)
      if (element.clientHeight > 0) {
        const hours = element.clientWidth < NARROW_WIDTH ? VISIBLE_HOURS_NARROW : VISIBLE_HOURS
        setHourHeight(Math.max(MIN_HOUR_HEIGHT, element.clientHeight / hours))
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [dayCount])

  // Start at 7:00, or earlier when this week has an earlier appointment.
  const firstHour = events
    .filter((e) => !isAllDayLike(e))
    .reduce((hour, e) => Math.min(hour, new Date(e.starts_at).getHours()), VISIBLE_FROM_HOUR)
  useEffect(() => {
    scroller.current?.scrollTo({ top: firstHour * hourHeight })
  }, [firstHour, hourHeight, shown])

  const memberOf = (e: CalendarEvent) => (e.member_id ? memberById.get(e.member_id) : undefined)
  const allDay = events.filter((e) => isAllDayLike(e) && days.some((day) => overlapsDay(e, day)))
  // Narrow time column on phones so the days get as much room as possible.
  const columns = 'grid [--time-col:1.75rem] sm:[--time-col:3.5rem]'
  const columnStyle = { gridTemplateColumns: `var(--time-col) repeat(${dayCount}, minmax(0, 1fr))` }

  function slotClick(day: Date, e: MouseEvent<HTMLDivElement>) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const minutes = Math.min(DAY_MINUTES - 30, Math.max(0, Math.floor((y / hourHeight) * 2) * 30))
    onSlotClick(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card">
      {/* Day headers */}
      <div className={`${columns} border-b border-line`} style={columnStyle}>
        <div />
        {days.map((day) => {
          const isToday = isSameDay(day, today)
          return (
            <button
              key={day.getTime()}
              type="button"
              aria-label={`Termin am ${formatWeekdayLong(day)} hinzufügen`}
              onClick={() => onDayClick(day)}
              className="flex flex-col items-center gap-0.5 border-l border-line py-2"
            >
              <span className={`text-xs font-semibold uppercase ${isToday ? 'text-ink' : 'text-ink/70'}`}>
                {formatWeekdayShort(day)}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full font-display text-base font-bold sm:size-10 sm:text-xl ${
                  isToday ? 'bg-ink text-white' : ''
                }`}
              >
                {day.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* All-day row */}
      {allDay.length > 0 && (
        <div className={`${columns} border-b border-line`} style={columnStyle}>
          <div className="px-1 py-2 text-right text-[11px] text-muted">
            <span className="hidden sm:inline">ganztägig</span>
          </div>
          {days.map((day) => (
            <div key={day.getTime()} className="flex min-w-0 flex-col gap-1 border-l border-line p-1">
              {allDay
                .filter((e) => overlapsDay(e, day))
                .map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event, day)}
                    className="truncate rounded-lg px-1 py-1 text-left text-[13px] font-semibold text-white sm:px-2 sm:text-sm"
                    style={{ backgroundColor: personColor(memberOf(event)?.color).value }}
                  >
                    {event.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${columns} relative`} style={{ ...columnStyle, height: hourHeight * 24 }}>
          <div className="relative">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-1 -translate-y-1/2 text-[13px] font-medium text-ink/70 sm:right-2 sm:text-xs"
                style={{ top: hour * hourHeight }}
              >
                {String(hour).padStart(2, '0')}
                <span className="hidden sm:inline">:00</span>
              </span>
            ))}
          </div>

          {days.map((day) => {
            const isToday = isSameDay(day, today)
            const nowMinutes = now.getHours() * 60 + now.getMinutes()
            return (
              <div
                key={day.getTime()}
                onClick={(e) => slotClick(day, e)}
                className={`relative cursor-pointer border-l border-line ${isToday ? 'bg-bg/60' : ''}`}
                style={{
                  backgroundImage: 'linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
                  backgroundSize: `100% ${hourHeight}px`,
                }}
              >
                {layoutDay(events, day).map(({ event, start, end, column, columns: count }) => {
                  const member = memberOf(event)
                  const height = ((end - start) / 60) * hourHeight - 2
                  // Narrow columns: later events overlap earlier ones, shifted right, so text stays horizontal.
                  const offset = narrowColumns ? Math.min(column * CASCADE_STEP, 0.6) : column / count
                  const share = narrowColumns ? 1 - offset : 1 / count
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event, day)
                      }}
                      className="absolute overflow-hidden rounded-md border border-white px-[3px] py-0.5 text-left text-white sm:rounded-lg sm:px-1.5"
                      style={{
                        top: (start / 60) * hourHeight + 1,
                        height,
                        left: `calc(${offset * 100}% + 2px)`,
                        width: `calc(${share * 100}% - 4px)`,
                        zIndex: column + 1,
                        backgroundColor: personColor(member?.color).value,
                      }}
                    >
                      <span className="block text-[13px] leading-[1.15] font-semibold [overflow-wrap:anywhere] hyphens-auto sm:truncate sm:text-sm sm:leading-tight">
                        {event.title}
                      </span>
                      {height >= 40 && !narrowColumns && (
                        <span className="block truncate text-xs leading-tight opacity-90">
                          {formatTime(new Date(event.starts_at))} – {formatTime(new Date(event.ends_at))}
                          {member ? ` · ${member.name}` : ''}
                        </span>
                      )}
                    </button>
                  )
                })}

                {isToday && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-danger"
                    style={{ top: (nowMinutes / 60) * hourHeight }}
                  >
                    <span className="absolute -top-[5px] -left-1 size-2 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
