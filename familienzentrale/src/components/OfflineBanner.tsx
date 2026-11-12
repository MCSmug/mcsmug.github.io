import { WifiOff } from 'lucide-react'

import { useOnline } from '../hooks/useOnline'

/** Tells the family why nothing loads or saves instead of failing silently. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <p
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-white"
    >
      <WifiOff size={16} />
      Keine Internetverbindung – Änderungen werden gerade nicht gespeichert.
    </p>
  )
}
