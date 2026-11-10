import { useCallback, useEffect, useState } from 'react'

import { startOfDay, toDateInput } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Task } from '../lib/types'

export interface TaskInput {
  assignee_id: string
  title: string
  icon: string | null
  due_date: string
  recurrence: string | null
  is_kid_task: boolean
}

const SAVE_ERROR = 'Das hat nicht geklappt. Bitte Verbindung prüfen und noch einmal versuchen.'

/**
 * All open tasks of a family, what was done today and the stars (completed
 * kid tasks) of the given children.
 */
export function useTasks(familyId: string, childIds: string[]) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set())
  const [stars, setStars] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const childKey = childIds.join(',')

  const refetch = useCallback(async () => {
    const now = new Date()
    const today = toDateInput(now)
    const ids = childKey ? childKey.split(',') : []

    const [taskResult, doneResult, ...starResults] = await Promise.all([
      // Finished one-off tasks disappear the day after.
      supabase
        .from('tasks')
        .select('*')
        .eq('family_id', familyId)
        .or(`done_at.is.null,done_at.gte.${startOfDay(now).toISOString()}`)
        .order('created_at'),
      supabase.from('task_completions').select('task_id').eq('day', today),
      ...ids.map((id) =>
        supabase
          .from('task_completions')
          .select('*', { count: 'exact', head: true })
          .eq('member_id', id)
          .eq('is_kid_task', true),
      ),
    ])

    if (taskResult.error || doneResult.error) {
      setError('Die Aufgaben konnten nicht geladen werden.')
    } else {
      setError(null)
      setTasks(taskResult.data as Task[])
      setDoneToday(new Set((doneResult.data as { task_id: string }[]).map((r) => r.task_id)))
      setStars(Object.fromEntries(ids.map((id, i) => [id, starResults[i].count ?? 0])))
    }
    setLoading(false)
  }, [familyId, childKey])

  useEffect(() => {
    const reload = () => void refetch()
    const channel = supabase
      .channel(`tasks:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, reload)
      .subscribe()

    // eslint-disable-next-line react/set-state-in-effect
    void refetch()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [familyId, refetch])

  const setDone = useCallback(
    async (task: Task, done: boolean) => {
      // Optimistic, so tiles react instantly to small fingers.
      setError(null)
      setDoneToday((prev) => {
        const next = new Set(prev)
        if (done) next.add(task.id)
        else next.delete(task.id)
        return next
      })
      if (!task.recurrence) {
        const doneAt = done ? new Date().toISOString() : null
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done_at: doneAt } : t)))
      }
      if (task.is_kid_task) {
        setStars((prev) => ({
          ...prev,
          [task.assignee_id]: Math.max(0, (prev[task.assignee_id] ?? 0) + (done ? 1 : -1)),
        }))
      }
      const { error } = await supabase.rpc('set_task_done', {
        p_task_id: task.id,
        p_day: toDateInput(new Date()),
        p_done: done,
      })
      if (error) setError(SAVE_ERROR)
      await refetch()
    },
    [refetch],
  )

  /** Creates (no id) or updates a task. Returns true on success. */
  const save = useCallback(
    async (input: TaskInput, id?: string) => {
      const { error } = id
        ? await supabase.from('tasks').update(input).eq('id', id)
        : await supabase.from('tasks').insert({ ...input, family_id: familyId })
      if (error) return false
      await refetch()
      return true
    },
    [familyId, refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) return false
      await refetch()
      return true
    },
    [refetch],
  )

  return { tasks, doneToday, stars, loading, error, setDone, save, remove }
}
