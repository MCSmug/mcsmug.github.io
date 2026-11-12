import { Bell, BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { currentSubscription, disablePush, enablePush, pushSupport } from '../lib/push'
import { Button, Card, ErrorNote } from './ui'

/** Settings: switch push notifications on or off for this device. */
export function PushCard({ memberId }: { memberId: string }) {
  const support = pushSupport()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (support !== 'ok') return
    let cancelled = false
    currentSubscription()
      .then((subscription) => {
        if (!cancelled) setEnabled(subscription !== null)
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [support])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (enabled) await disablePush()
      else await enablePush(memberId)
      setEnabled(!enabled)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    }
    setBusy(false)
  }

  return (
    <Card>
      <h2 className="font-display text-xl font-semibold">Benachrichtigungen</h2>
      {support === 'ok' ? (
        <>
          <p className="mt-1 mb-3 text-sm text-muted">
            {enabled
              ? 'Dieses Gerät bekommt Erinnerungen und Nachrichten, die als Push gesendet werden.'
              : 'Erinnerungen und wichtige Nachrichten der Familie direkt auf dieses Gerät bekommen.'}
          </p>
          {error && (
            <div className="mb-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          <Button variant={enabled ? 'secondary' : 'primary'} disabled={busy || enabled === null} onClick={() => void toggle()}>
            {enabled ? <BellOff size={18} /> : <Bell size={18} />}
            {enabled ? 'Auf diesem Gerät ausschalten' : 'Auf diesem Gerät einschalten'}
          </Button>
        </>
      ) : support === 'ios-install' ? (
        <p className="mt-1 text-sm text-muted">
          Auf iPhone und iPad gibt es Benachrichtigungen nur für Apps auf dem Home-Bildschirm: In Safari
          auf „Teilen“ tippen, „Zum Home-Bildschirm“ wählen, die App von dort öffnen und hier einschalten.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Dieser Browser unterstützt keine Benachrichtigungen.</p>
      )}
    </Card>
  )
}
