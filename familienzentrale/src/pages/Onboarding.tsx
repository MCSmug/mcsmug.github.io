import { useState, type FormEvent } from 'react'

import { ColorPicker } from '../components/ColorPicker'
import { Button, ErrorNote, Field, TextInput } from '../components/ui'
import { useFamilyState } from '../context/family'
import { PERSON_COLORS } from '../lib/colors'
import { supabase } from '../lib/supabase'

export function Onboarding({ email }: { email: string | undefined }) {
  const { reload } = useFamilyState()
  const [familyName, setFamilyName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [color, setColor] = useState(PERSON_COLORS[0].value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('create_family', {
      family_name: familyName,
      member_name: memberName,
      member_color: color,
    })
    if (error) {
      setBusy(false)
      setError('Die Familie konnte nicht angelegt werden. Bitte noch einmal versuchen.')
      return
    }
    await reload()
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl font-bold">Familie anlegen</h1>
        <p className="mt-2 text-muted">
          Weitere Familienmitglieder fügst du danach in den Einstellungen hinzu.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Name der Familie">
          <TextInput
            required
            maxLength={80}
            placeholder="Familie Muster"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </Field>
        <Field label="Dein Name">
          <TextInput
            required
            maxLength={40}
            placeholder="Papa"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Deine Farbe</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={busy || !familyName.trim() || !memberName.trim()}>
          Familie anlegen
        </Button>
      </form>

      <p className="text-sm text-muted">
        Deine Familie gibt es schon? Dann bitte ein Elternteil, dich in den Einstellungen mit der
        Adresse {email ? <strong>{email}</strong> : 'deines Kontos'} einzuladen, und lade diese
        Seite danach neu.{' '}
        <button type="button" className="underline" onClick={() => void supabase.auth.signOut()}>
          Abmelden
        </button>
      </p>
    </main>
  )
}
