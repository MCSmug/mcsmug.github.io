import { Share, Smartphone, X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

import { canPromptInstall, isInstalled, isIos, promptInstall, subscribeInstall } from '../lib/install'
import { Button } from './ui'

const DISMISSED_KEY = 'install-hint-dismissed'

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Suggests adding the app to the home screen, once, until installed or dismissed. */
export function InstallHint() {
  const promptable = useSyncExternalStore(subscribeInstall, canPromptInstall)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [installed] = useState(isInstalled)
  const [ios] = useState(isIos)

  if (installed || dismissed || (!promptable && !ios)) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Without storage the hint simply shows again next time.
    }
  }

  return (
    <aside
      aria-label="Als App installieren"
      className="mx-5 mt-2 flex shrink-0 items-start gap-3 rounded-2xl border border-line bg-card p-3"
    >
      <Smartphone size={22} className="mt-0.5 shrink-0 text-muted" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Als App installieren</p>
        {promptable ? (
          <>
            <p className="text-muted">Mit eigenem Symbol auf dem Startbildschirm, ohne Browserleiste.</p>
            <Button
              className="mt-2 !min-h-11 text-sm"
              onClick={() => void promptInstall().then((accepted) => accepted && dismiss())}
            >
              Installieren
            </Button>
          </>
        ) : (
          <p className="text-muted">
            Tippe auf das Teilen-Symbol <Share size={14} className="inline align-text-top" aria-label="Teilen" /> und
            dann auf „Zum Home-Bildschirm“. Nur so gibt es auf dem iPhone auch Benachrichtigungen. Fehlt der
            Eintrag, öffne die Seite zuerst in Safari.
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Hinweis schließen"
        onClick={dismiss}
        className="-m-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted"
      >
        <X size={20} />
      </button>
    </aside>
  )
}
