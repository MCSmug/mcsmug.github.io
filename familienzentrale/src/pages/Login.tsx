import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button, ErrorNote, Field, TextInput } from '../components/ui'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [showCode, setShowCode] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) {
      setError('Die E-Mail konnte nicht gesendet werden. Bitte Adresse prüfen und später noch einmal versuchen.')
    } else {
      setSentTo(address)
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (!sentTo || !code.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: sentTo,
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) setError('Der Code ist falsch oder abgelaufen.')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-4xl font-bold">Familienzentrale</h1>
        <p className="mt-2 text-muted">Kalender, Aufgaben und Einkaufsliste für die ganze Familie.</p>
      </div>

      {sentTo ? (
        <form onSubmit={verifyCode} className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-3xl border border-line bg-card p-5">
            <Mail className="mt-0.5 shrink-0 text-muted" size={22} />
            <p>
              Wir haben eine E-Mail an <strong>{sentTo}</strong> geschickt. Öffne den Link darin auf
              diesem Gerät, dann bist du angemeldet. Schau auch im Spam-Ordner nach.
            </p>
          </div>
          {showCode ? (
            <>
              <Field label="Code aus der E-Mail">
                <TextInput
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              {error && <ErrorNote>{error}</ErrorNote>}
              <Button type="submit" disabled={busy || !code.trim()}>
                Anmelden
              </Button>
            </>
          ) : (
            <button
              type="button"
              className="min-h-12 self-start text-sm text-muted underline"
              onClick={() => setShowCode(true)}
            >
              In der E-Mail steht ein Code? Hier eingeben
            </button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setSentTo(null)
              setCode('')
              setShowCode(false)
              setError(null)
            }}
          >
            Andere E-Mail-Adresse
          </Button>
        </form>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-4">
          <Field label="E-Mail-Adresse">
            <TextInput
              type="email"
              required
              autoComplete="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" disabled={busy}>
            Anmelde-Link senden
          </Button>
          <p className="text-sm text-muted">Kein Passwort nötig: Du bekommst einen Link per E-Mail.</p>
        </form>
      )}
    </main>
  )
}
