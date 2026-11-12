import { Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { supabase } from '../lib/supabase'
import type { Member } from '../lib/types'
import { ColorPicker } from './ColorPicker'
import { Button, ErrorNote, Field, TextInput } from './ui'

interface Props {
  member: Member
  /** The signed-in member cannot remove themselves here (see "Konto löschen"). */
  isMe: boolean
  onClose: () => void
  /** Called after a successful change so the member list reloads. */
  onChanged: () => Promise<void>
}

export function MemberDialog({ member, isMe, onClose, onChanged }: Props) {
  const [name, setName] = useState(member.name)
  const [color, setColor] = useState(member.color)
  const [email, setEmail] = useState(member.invite_email ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A parent without a login can (still) be invited by e-mail.
  const canInvite = member.role === 'parent' && !member.user_id

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('members')
      .update({
        name: name.trim(),
        color,
        ...(canInvite ? { invite_email: email.trim() ? email.trim().toLowerCase() : null } : {}),
      })
      .eq('id', member.id)
    setBusy(false)
    if (error) {
      setError('Die Änderung konnte nicht gespeichert werden.')
      return
    }
    await onChanged()
    onClose()
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('members').delete().eq('id', member.id)
    setBusy(false)
    if (error) {
      setError('Das Mitglied konnte nicht entfernt werden.')
      return
    }
    await onChanged()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="member-dialog-title" className="font-display text-2xl font-bold">
            {member.name}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="flex size-12 items-center justify-center rounded-full text-muted"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name">
            <TextInput required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Farbe</span>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {canInvite && (
            <div>
              <Field label="E-Mail-Adresse für den Login (optional)">
                <TextInput
                  type="email"
                  autoComplete="off"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <p className="mt-1.5 text-sm text-muted">
                Wer sich mit dieser Adresse anmeldet, gehört automatisch zur Familie.
              </p>
            </div>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}

          {confirmDelete ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
              <p>
                {member.name} wirklich entfernen? Die Aufgaben und Sterne dieses Mitglieds werden gelöscht,
                Termine und Nachrichten bleiben ohne Namen erhalten.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setConfirmDelete(false)} className="flex-1">
                  Abbrechen
                </Button>
                <Button onClick={() => void remove()} disabled={busy} className="flex-1 bg-danger">
                  Entfernen
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              {!isMe && (
                <Button
                  variant="secondary"
                  aria-label={`${member.name} entfernen`}
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  <Trash2 size={20} />
                </Button>
              )}
              <Button type="submit" disabled={busy || !name.trim()} className="flex-1">
                Speichern
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
