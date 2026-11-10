import { X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { KidsBoard } from '../components/KidsBoard'

/** Kids' mode on phones and tablets: full screen, without the app navigation. */
export function Kids() {
  return (
    <main className="mx-auto min-h-dvh max-w-7xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
      <div className="mb-3 flex justify-end">
        <Link
          to="/aufgaben"
          aria-label="Kindermodus schließen"
          className="flex size-12 items-center justify-center rounded-full text-muted"
        >
          <X size={22} />
        </Link>
      </div>
      <KidsBoard />
    </main>
  )
}
