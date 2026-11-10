import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import type { CalendarEvent } from '../lib/types'

export interface EventInput {
  title: string
  member_id: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
}

/** Events of one family that overlap the range [from, to). */
export function useEvents(familyId: string, from: Date, to: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('family_id', familyId)
      .lt('starts_at', toIso)
      .gt('ends_at', fromIso)
      .order('starts_at')
    if (error) {
      setError('Die Termine konnten nicht geladen werden.')
    } else {
      setError(null)
      setEvents(data as CalendarEvent[])
    }
    setLoading(false)
  }, [familyId, fromIso, toIso])

  useEffect(() => {
    // Any change in the table may affect the visible range, so simply reload.
    const channel = supabase
      .channel(`events:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        void refetch()
      })
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

  /** Creates (no id) or updates an event. Returns true on success. */
  const save = useCallback(
    async (input: EventInput, id?: string) => {
      const { error } = id
        ? await supabase.from('events').update(input).eq('id', id)
        : await supabase.from('events').insert({ ...input, family_id: familyId })
      if (error) return false
      await refetch()
      return true
    },
    [familyId, refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) return false
      await refetch()
      return true
    },
    [refetch],
  )

  return { events, loading, error, save, remove }
}
