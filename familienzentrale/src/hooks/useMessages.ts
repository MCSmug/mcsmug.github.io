import { useCallback, useEffect, useState } from 'react'

import { pushMessage } from '../lib/push'
import { supabase } from '../lib/supabase'
import type { Message } from '../lib/types'

const PAGE_SIZE = 100

/** The latest messages of a family, oldest first, kept up to date in realtime. */
export function useMessages(familyId: string, authorId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (error) {
      setError('Die Nachrichten konnten nicht geladen werden.')
    } else {
      setError(null)
      setMessages((data as Message[]).reverse())
    }
    setLoading(false)
  }, [familyId])

  useEffect(() => {
    const reload = () => void refetch()
    const channel = supabase
      .channel(`messages:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, reload)
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

  /** Returns true when the message was stored. With `push` the family also gets a notification. */
  const send = useCallback(
    async (rawText: string, push = false) => {
      const text = rawText.trim()
      if (!text) return false
      const message: Message = {
        id: crypto.randomUUID(),
        family_id: familyId,
        author_id: authorId,
        text,
        send_push: push,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, message])
      const { error } = await supabase
        .from('messages')
        .insert({ id: message.id, family_id: familyId, author_id: authorId, text, send_push: push })
      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== message.id))
        setError('Die Nachricht konnte nicht gesendet werden.')
        return false
      }
      setError(null)
      if (push) void pushMessage(message.id)
      return true
    },
    [familyId, authorId],
  )

  const remove = useCallback(
    async (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
      const { error } = await supabase.from('messages').delete().eq('id', id)
      if (error) void refetch()
    },
    [refetch],
  )

  return { messages, loading, error, send, remove }
}
