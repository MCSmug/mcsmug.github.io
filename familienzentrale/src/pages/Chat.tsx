import { BellRing, SendHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ReminderDialog } from '../components/ReminderDialog'
import { Button, ErrorNote, TextInput } from '../components/ui'
import { useFamily } from '../context/family'
import { useMessages } from '../hooks/useMessages'
import { personColor } from '../lib/colors'
import { isSameDay } from '../lib/dates'

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

export function Chat() {
  const { family, me, members } = useFamily()
  const { messages, loading, error, send, remove } = useMessages(family.id, me.id)
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [push, setPush] = useState(false)
  const [reminders, setReminders] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const memberById = new Map(members.map((m) => [m.id, m]))

  // Keep the newest message in view.
  const lastId = messages.at(-1)?.id
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  function submit(event: FormEvent) {
    event.preventDefault()
    const current = text
    setText('')
    void send(current, push).then((ok) => {
      if (!ok) setText(current)
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Familie</h1>
        <button
          type="button"
          onClick={() => setReminders(true)}
          className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-card px-4 font-semibold"
        >
          <BellRing size={18} />
          Erinnerungen
        </button>
      </div>

      <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">
        {loading ? (
          <p className="text-muted">Lädt …</p>
        ) : messages.length === 0 ? (
          <p className="text-muted">Noch keine Nachrichten. Schreib die erste!</p>
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {messages.map((message, index) => {
              const author = message.author_id ? memberById.get(message.author_id) : undefined
              const mine = message.author_id === me.id
              const color = personColor(author?.color)
              const sentAt = new Date(message.created_at)
              const previous = messages[index - 1]
              const newDay = !previous || !isSameDay(new Date(previous.created_at), sentAt)
              return (
                <li key={message.id} className="flex flex-col">
                  {newDay && (
                    <p className="my-2 self-center text-xs font-medium text-muted">{dayFormat.format(sentAt)}</p>
                  )}
                  <div className={`flex max-w-[85%] items-end gap-1 ${mine ? 'flex-row-reverse self-end' : 'self-start'}`}>
                    <button
                      type="button"
                      disabled={!mine}
                      onClick={() => setSelected(selected === message.id ? null : message.id)}
                      className="rounded-2xl px-4 py-2 text-left"
                      style={
                        mine
                          ? { backgroundColor: color.value, color: '#fff' }
                          : { backgroundColor: color.tint, color: 'var(--color-ink)' }
                      }
                    >
                      {!mine && (
                        <span className="block text-xs font-semibold" style={{ color: color.value }}>
                          {author?.name ?? 'Ehemaliges Mitglied'}
                        </span>
                      )}
                      <span className="break-words whitespace-pre-wrap">{message.text}</span>
                      <span className={`mt-0.5 block text-right text-[11px] ${mine ? 'opacity-80' : 'text-muted'}`}>
                        {timeFormat.format(sentAt)}
                      </span>
                    </button>
                    {mine && selected === message.id && (
                      <button
                        type="button"
                        aria-label="Nachricht löschen"
                        onClick={() => void remove(message.id)}
                        className="flex size-12 shrink-0 items-center justify-center rounded-full text-danger"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div ref={end} />
      </div>

      {error && (
        <div className="mt-2 shrink-0">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <label className="mt-2 flex min-h-11 shrink-0 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={push}
          onChange={(e) => setPush(e.target.checked)}
          className="size-5 accent-ink"
        />
        Auch als Push senden
      </label>
      <form onSubmit={submit} className="flex shrink-0 gap-2 pb-3">
        <TextInput
          aria-label="Nachricht"
          placeholder="Nachricht an die Familie"
          maxLength={1000}
          enterKeyHint="send"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" aria-label="Senden" disabled={!text.trim()} className="!px-4">
          <SendHorizontal size={22} />
        </Button>
      </form>

      {reminders && (
        <ReminderDialog familyId={family.id} members={members} onClose={() => setReminders(false)} />
      )}
    </div>
  )
}
