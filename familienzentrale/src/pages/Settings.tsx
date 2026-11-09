import { LogOut, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { PageTitle } from '../components/AppShell'
import { ColorPicker } from '../components/ColorPicker'
import { Avatar, Button, Card, ErrorNote, Field, TextInput } from '../components/ui'
import { useAuth } from '../context/auth'
import { useFamily } from '../context/family'
import { PERSON_COLORS } from '../lib/colors'
import { supabase } from '../lib/supabase'
import type { Member, MemberRole } from '../lib/types'

function memberStatus(member: Member, isMe: boolean): string {
  if (member.role === 'child') return 'Kind'
  if (isMe) return 'Elternteil · das bist du'
  if (member.user_id) return 'Elternteil'
  if (member.invite_email) return `Elternteil · eingeladen: ${member.invite_email}`
  return 'Elternteil · ohne Login'
}

export function Settings() {
  const { session } = useAuth()
  const { family, me, members, reload } = useFamily()
  const isParent = me.role === 'parent'

  const usedColors = new Set(members.map((m) => m.color.toUpperCase()))
  const firstFreeColor = (PERSON_COLORS.find((c) => !usedColors.has(c.value)) ?? PERSON_COLORS[0]).value

  const [name, setName] = useState('')
  const [role, setRole] = useState<MemberRole>('child')
  const [color, setColor] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function addMember(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('members').insert({
      family_id: family.id,
      name: name.trim(),
      role,
      color: color ?? firstFreeColor,
      invite_email: role === 'parent' && email.trim() ? email.trim().toLowerCase() : null,
    })
    setBusy(false)
    if (error) {
      setError('Das Mitglied konnte nicht gespeichert werden.')
      return
    }
    setName('')
    setEmail('')
    setColor(null)
    await reload()
  }

  async function removeMember(member: Member) {
    setError(null)
    const { error } = await supabase.from('members').delete().eq('id', member.id)
    setConfirmDelete(null)
    if (error) setError('Das Mitglied konnte nicht entfernt werden.')
    await reload()
  }

  return (
    <>
      <PageTitle>Einstellungen</PageTitle>

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 font-display text-xl font-semibold">Mitglieder</h2>
          <ul className="divide-y divide-line">
            {members.map((member) => (
              <li key={member.id} className="flex min-h-16 items-center gap-3 py-2">
                <Avatar member={member} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{member.name}</p>
                  <p className="truncate text-sm text-muted">{memberStatus(member, member.id === me.id)}</p>
                </div>
                {isParent &&
                  member.id !== me.id &&
                  (confirmDelete === member.id ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setConfirmDelete(null)} className="px-3 text-sm">
                        Abbrechen
                      </Button>
                      <Button onClick={() => void removeMember(member)} className="bg-danger px-3 text-sm">
                        Entfernen
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${member.name} entfernen`}
                      onClick={() => setConfirmDelete(member.id)}
                      className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted"
                    >
                      <Trash2 size={20} />
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </Card>

        {isParent && (
          <Card>
            <h2 className="mb-3 font-display text-xl font-semibold">Mitglied hinzufügen</h2>
            <form onSubmit={addMember} className="flex flex-col gap-4">
              <Field label="Name">
                <TextInput required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>

              <div role="radiogroup" aria-label="Rolle" className="grid grid-cols-2 gap-2">
                {(['child', 'parent'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={role === option}
                    onClick={() => setRole(option)}
                    className={`min-h-12 rounded-2xl border font-semibold ${
                      role === option ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink'
                    }`}
                  >
                    {option === 'child' ? 'Kind' : 'Elternteil'}
                  </button>
                ))}
              </div>

              {role === 'parent' && (
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

              <div>
                <span className="mb-1.5 block text-sm font-medium text-muted">Farbe</span>
                <ColorPicker value={color ?? firstFreeColor} onChange={setColor} />
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}
              <Button type="submit" disabled={busy || !name.trim()}>
                Hinzufügen
              </Button>
            </form>
          </Card>
        )}

        <Card>
          <h2 className="font-display text-xl font-semibold">Konto</h2>
          <p className="mt-1 mb-3 text-sm text-muted">Angemeldet als {session?.user.email}</p>
          <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>
            <LogOut size={18} />
            Abmelden
          </Button>
        </Card>
      </div>
    </>
  )
}
