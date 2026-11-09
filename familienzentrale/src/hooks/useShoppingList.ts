import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import type { ShoppingItem } from '../lib/types'

const SAVE_ERROR = 'Das hat nicht geklappt. Bitte Verbindung prüfen und noch einmal versuchen.'

function upsert(items: ShoppingItem[], item: ShoppingItem): ShoppingItem[] {
  const exists = items.some((i) => i.id === item.id)
  return exists ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]
}

export function useShoppingList(familyId: string, memberId: string) {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('shopping_items')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at')
    if (error) {
      setError('Die Einkaufsliste konnte nicht geladen werden.')
    } else {
      setItems(data as ShoppingItem[])
    }
    setLoading(false)
  }, [familyId])

  useEffect(() => {
    const filter = `family_id=eq.${familyId}`
    const channel = supabase
      .channel(`shopping:${familyId}`)
      .on<ShoppingItem>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shopping_items', filter },
        (payload) => setItems((prev) => upsert(prev, payload.new)),
      )
      .on<ShoppingItem>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shopping_items', filter },
        (payload) => setItems((prev) => upsert(prev, payload.new)),
      )
      // DELETE events cannot be filtered and only carry the primary key.
      .on<ShoppingItem>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shopping_items' },
        (payload) => setItems((prev) => prev.filter((i) => i.id !== payload.old.id)),
      )
      // (Re)load on every successful subscribe so nothing is missed after a reconnect.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refetch()
      })

    // Initial load, independent of the realtime connection.
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

  // All writes are optimistic; on failure the server state is reloaded.
  const fail = useCallback(() => {
    setError(SAVE_ERROR)
    void refetch()
  }, [refetch])

  const add = useCallback(
    async (rawName: string) => {
      const name = rawName.trim()
      if (!name) return
      const item: ShoppingItem = {
        id: crypto.randomUUID(),
        family_id: familyId,
        name,
        added_by: memberId,
        done: false,
        created_at: new Date().toISOString(),
      }
      setError(null)
      setItems((prev) => upsert(prev, item))
      const { error } = await supabase.from('shopping_items').insert({
        id: item.id,
        family_id: item.family_id,
        name: item.name,
        added_by: item.added_by,
      })
      if (error) fail()
    },
    [familyId, memberId, fail],
  )

  const toggle = useCallback(
    async (item: ShoppingItem) => {
      const done = !item.done
      setError(null)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done } : i)))
      const { error } = await supabase.from('shopping_items').update({ done }).eq('id', item.id)
      if (error) fail()
    },
    [fail],
  )

  const remove = useCallback(
    async (item: ShoppingItem) => {
      setError(null)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      const { error } = await supabase.from('shopping_items').delete().eq('id', item.id)
      if (error) fail()
    },
    [fail],
  )

  const clearDone = useCallback(async () => {
    setError(null)
    setItems((prev) => prev.filter((i) => !i.done))
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('family_id', familyId)
      .eq('done', true)
    if (error) fail()
  }, [familyId, fail])

  return { items, loading, error, add, toggle, remove, clearDone }
}
