// Turns an iCalendar file into plain event rows. No I/O in here, so it can be tested on its own.
import ICAL from 'npm:ical.js@2.2.1'

export interface ParsedEvent {
  external_id: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
}

const MAX_OCCURRENCES_PER_EVENT = 1500
const DAY_MS = 24 * 60 * 60 * 1000

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** The instant at which a wall clock in `timeZone` shows the given date and time. */
function wallTimeToInstant(y: number, m: number, d: number, h: number, min: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min)
  const first = guess - zoneOffset(guess, timeZone)
  // Around a daylight-saving change the offset at the guess can differ from the one at the result.
  return new Date(guess - zoneOffset(first, timeZone))
}

function toInstant(time: ICAL.Time, timeZone: string): Date {
  // All-day values and "floating" times have no zone of their own: they mean the family's local time.
  if (time.isDate) return wallTimeToInstant(time.year, time.month, time.day, 0, 0, timeZone)
  if (!time.zone || time.zone === ICAL.Timezone.localTimezone) {
    return wallTimeToInstant(time.year, time.month, time.day, time.hour, time.minute, timeZone)
  }
  return time.toJSDate()
}

/**
 * Events of a calendar that overlap [from, to), with recurring events expanded.
 * `timeZone` is used for all-day events and times without a zone.
 */
export function parseCalendar(text: string, from: Date, to: Date, timeZone: string): ParsedEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(text))
  for (const zone of calendar.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(zone)
  }

  // Group the VEVENTs of one series: the master plus its changed occurrences.
  const series = new Map<string, { master?: ICAL.Component; exceptions: ICAL.Component[] }>()
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    const uid = String(vevent.getFirstPropertyValue('uid') ?? '')
    if (!uid) continue
    const entry = series.get(uid) ?? { exceptions: [] }
    if (vevent.hasProperty('recurrence-id')) entry.exceptions.push(vevent)
    else entry.master = vevent
    series.set(uid, entry)
  }

  const result: ParsedEvent[] = []
  const add = (id: string, title: string, start: ICAL.Time, end: ICAL.Time) => {
    const allDay = start.isDate
    const startsAt = toInstant(start, timeZone)
    let endsAt = toInstant(end, timeZone)
    if (endsAt <= startsAt) endsAt = new Date(startsAt.getTime() + (allDay ? DAY_MS : 60 * 60 * 1000))
    if (startsAt >= to || endsAt <= from) return
    result.push({
      external_id: id,
      title: (title || '(Ohne Titel)').trim().slice(0, 120),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: allDay,
    })
  }
  const cancelled = (c: ICAL.Component) => String(c.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED'

  for (const [uid, { master, exceptions }] of series) {
    if (!master) {
      // Changed occurrences whose series is not part of the file: take them as single events.
      for (const exception of exceptions) {
        if (cancelled(exception)) continue
        const event = new ICAL.Event(exception)
        add(`${uid}_${event.startDate.toString()}`, event.summary, event.startDate, event.endDate)
      }
      continue
    }
    if (cancelled(master)) continue

    const event = new ICAL.Event(master)
    for (const exception of exceptions) event.relateException(exception)

    if (!event.isRecurring()) {
      add(uid, event.summary, event.startDate, event.endDate)
      continue
    }

    const iterator = event.iterator()
    for (let i = 0; i < MAX_OCCURRENCES_PER_EVENT; i++) {
      const next = iterator.next()
      if (!next) break
      const occurrence = event.getOccurrenceDetails(next)
      if (toInstant(occurrence.startDate, timeZone) >= to) break
      if (cancelled(occurrence.item.component)) continue
      add(`${uid}_${next.toString()}`, occurrence.item.summary, occurrence.startDate, occurrence.endDate)
    }
  }
  return result
}
