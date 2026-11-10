// Small date helpers. All calculations use the device's local time zone.

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, date.getHours(), date.getMinutes())
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  const sinceMonday = (day.getDay() + 6) % 7
  return addDays(day, -sinceMonday)
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

/** ISO 8601 week number. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Value for <input type="date">. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Value for <input type="time">. */
export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromInputs(date: string, time = '00:00'): Date {
  return new Date(`${date}T${time}`)
}

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })
const weekdayLong = new Intl.DateTimeFormat('de-DE', { weekday: 'long' })
const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatTime = (date: Date) => timeFormat.format(date)
export const formatWeekdayShort = (date: Date) => weekdayShort.format(date).replace('.', '')
export const formatWeekdayLong = (date: Date) => weekdayLong.format(date)

export function formatDayRange(start: Date, end: Date): string {
  return `${dayMonth.format(start)} – ${dayMonthYear.format(end)}`
}

const dayOnly = new Intl.DateTimeFormat('de-DE', { day: 'numeric' })

/** Compact range without the year, e.g. "7. – 9. Nov." or "30. Nov. – 2. Dez." */
export function formatDayRangeShort(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  return `${sameMonth ? `${dayOnly.format(start)}.` : dayMonth.format(start)} – ${dayMonth.format(end)}`
}

export function formatWeekRange(weekStart: Date): string {
  return formatDayRange(weekStart, addDays(weekStart, 6))
}
