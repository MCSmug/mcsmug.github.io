import { toDateInput } from './dates'
import type { Task } from './types'

/** RFC 5545 weekday codes, Monday first. */
export const WEEKDAYS = [
  { code: 'MO', label: 'Mo' },
  { code: 'TU', label: 'Di' },
  { code: 'WE', label: 'Mi' },
  { code: 'TH', label: 'Do' },
  { code: 'FR', label: 'Fr' },
  { code: 'SA', label: 'Sa' },
  { code: 'SU', label: 'So' },
]

export type Repeat = { kind: 'once' } | { kind: 'daily' } | { kind: 'weekly'; days: string[] }

export function parseRecurrence(rule: string | null): Repeat {
  if (!rule) return { kind: 'once' }
  if (rule === 'FREQ=DAILY') return { kind: 'daily' }
  const days = /BYDAY=([A-Z,]+)/.exec(rule)?.[1].split(',') ?? []
  return { kind: 'weekly', days }
}

export function toRecurrence(repeat: Repeat): string | null {
  if (repeat.kind === 'once') return null
  if (repeat.kind === 'daily') return 'FREQ=DAILY'
  const days = WEEKDAYS.map((d) => d.code).filter((code) => repeat.days.includes(code))
  return `FREQ=WEEKLY;BYDAY=${days.join(',')}`
}

export function describeRecurrence(rule: string | null): string | null {
  const repeat = parseRecurrence(rule)
  if (repeat.kind === 'once') return null
  if (repeat.kind === 'daily' || repeat.days.length === 7) return 'Jeden Tag'
  return WEEKDAYS.filter((d) => repeat.days.includes(d.code))
    .map((d) => d.label)
    .join(', ')
}

export interface TaskToday {
  task: Task
  done: boolean
}

/**
 * Tasks that belong on today's list: recurring tasks scheduled for today and
 * one-off tasks that are due (or overdue) or were finished today.
 */
export function tasksForToday(tasks: Task[], doneToday: Set<string>, today: Date): TaskToday[] {
  const day = toDateInput(today)
  const weekday = WEEKDAYS[(today.getDay() + 6) % 7].code
  const result: TaskToday[] = []

  for (const task of tasks) {
    const repeat = parseRecurrence(task.recurrence)
    if (repeat.kind === 'once') {
      if (task.done_at) {
        if (toDateInput(new Date(task.done_at)) === day) result.push({ task, done: true })
      } else if (task.due_date <= day) {
        result.push({ task, done: false })
      }
    } else if (task.due_date <= day && (repeat.kind === 'daily' || repeat.days.includes(weekday))) {
      result.push({ task, done: doneToday.has(task.id) })
    }
  }
  return result
}

/** One-off tasks with a due date after today. */
export function upcomingTasks(tasks: Task[], today: Date): Task[] {
  const day = toDateInput(today)
  return tasks
    .filter((t) => !t.recurrence && !t.done_at && t.due_date > day)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}
