import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { supabase } from '../lib/supabase'
import { Button, ErrorNote } from './ui'

interface Props {
  familyId: string
  authorId: string
  onClose: () => void
}

/** "Nachricht an alle" on the wall panel: writes into the family chat. */
export function BroadcastDialog({ familyId, authorId, onClose }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('messages')
      .insert({ family_id: familyId, author_id: authorId, text: text.trim() })
    setBusy(false)
    if (error) setError('Die Nachricht konnte nicht gesendet werden.')
    else onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl bg-bg p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="broadcast-title" className="font-display text-3xl font-bold">
            Nachricht an alle
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="flex size-14 items-center justify-center rounded-full text-muted"
          >
            <X size={26} />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <textarea
            aria-label="Nachricht"
            autoFocus
            required
            maxLength={1000}
            rows={4}
            placeholder="Essen ist fertig!"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-2xl border border-line bg-card p-4 text-xl text-ink placeholder:text-muted/70"
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy || !text.trim()} className="min-h-16 text-xl">
            Senden
          </Button>
        </form>
      </div>
    </div>
  )
}
