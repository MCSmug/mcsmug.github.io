import { RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { supabase } from '../lib/supabase'
import type { CalendarFeed, Member } from '../lib/types'
import { Button, Card, ErrorNote, Field, TextInput } from './ui'

const syncFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Settings: calendars subscribed by their iCal address (Google, iCloud, Outlook ...). */
export function FeedsCard({ familyId, members }: { familyId: string; members: Member[] }) {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [memberId, setMemberId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('calendar_feeds').select('*').eq('family_id', familyId).order('created_at')
    if (!error) setFeeds(data as CalendarFeed[])
  }, [familyId])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  async function sync() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.functions.invoke('sync-calendars', { body: {} })
    if (error) setError('Die Kalender konnten nicht aktualisiert werden.')
    await load()
    setBusy(false)
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    // Apple and others hand out webcal:// links; they are plain https underneath.
    const address = url.trim().replace(/^webcal:\/\//i, 'https://')
    if (!/^https:\/\//i.test(address)) {
      setError('Die Adresse muss mit https:// oder webcal:// beginnen.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('calendar_feeds')
      .insert({ family_id: familyId, member_id: memberId || null, name: name.trim(), ical_url: address })
    if (error) {
      setBusy(false)
      setError('Der Kalender konnte nicht gespeichert werden.')
      return
    }
    setName('')
    setUrl('')
    await sync()
  }

  async function remove(id: string) {
    setFeeds((prev) => prev.filter((f) => f.id !== id))
    await supabase.from('calendar_feeds').delete().eq('id', id)
    await load()
  }

  const memberName = (id: string | null) => (id ? (members.find((m) => m.id === id)?.name ?? '–') : 'Alle')

  return (
    <Card>
      <h2 className="font-display text-xl font-semibold">Kalender abonnieren</h2>
      <p className="mt-1 mb-3 text-sm text-muted">
        Termine aus Google, iCloud oder Outlook übernehmen. Sie werden etwa alle 30 Minuten aktualisiert und
        lassen sich hier nur ansehen, nicht ändern.
      </p>

      {feeds.length > 0 && (
        <>
          <ul className="mb-3 divide-y divide-line">
            {feeds.map((feed) => (
              <li key={feed.id} className="flex min-h-14 items-center gap-2 py-1">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {feed.name} <span className="font-normal text-muted">· {memberName(feed.member_id)}</span>
                  </p>
                  {feed.last_error ? (
                    <p className="text-sm text-danger">Fehler: {feed.last_error}</p>
                  ) : (
                    <p className="text-sm text-muted">
                      {feed.last_synced_at
                        ? `Aktualisiert: ${syncFormat.format(new Date(feed.last_synced_at))}`
                        : 'Noch nicht aktualisiert'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Kalender ${feed.name} entfernen`}
                  onClick={() => void remove(feed.id)}
                  className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" disabled={busy} onClick={() => void sync()} className="mb-4">
            <RefreshCw size={18} className={busy ? 'animate-spin' : ''} />
            Jetzt aktualisieren
          </Button>
        </>
      )}

      <form onSubmit={add} className="flex flex-col gap-4">
        <Field label="Name">
          <TextInput required maxLength={60} placeholder="Arbeit" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <Field label="Kalender-Adresse (iCal)">
            <TextInput
              required
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              placeholder="https://…/basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <p className="mt-1.5 text-sm text-muted">
            Google: Kalender-Einstellungen → „Geheime Adresse im iCal-Format“. iCloud: Kalender freigeben →
            „Öffentlicher Kalender“ → Link kopieren. Wer die Adresse kennt, kann den Kalender lesen.
          </p>
        </div>
        <Field label="Wessen Kalender?">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-card px-3 text-base"
          >
            <option value="">Alle</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" disabled={busy || !name.trim() || !url.trim()}>
          Kalender hinzufügen
        </Button>
      </form>
    </Card>
  )
}
