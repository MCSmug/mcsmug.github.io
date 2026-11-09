import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ShoppingRow } from '../components/ShoppingRow'
import { Card } from '../components/ui'
import { useFamily } from '../context/family'
import { useShoppingList } from '../hooks/useShoppingList'

const PREVIEW_COUNT = 5

export function Today() {
  const { family, me, members } = useFamily()
  const { items, loading, toggle } = useShoppingList(family.id, me.id)

  const open = items.filter((i) => !i.done)
  const memberById = new Map(members.map((m) => [m.id, m]))
  const [now] = useState(() => new Date())
  const today = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  return (
    <>
      <p className="text-muted">{today}</p>
      <h1 className="mb-4 font-display text-3xl font-bold">Hallo {me.name}</h1>

      <Card>
        <Link to="/einkauf" className="flex min-h-12 items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Einkauf</h2>
          <span className="flex items-center gap-1 text-sm font-medium text-muted">
            {loading ? '' : open.length === 0 ? 'Alles da' : `${open.length} offen`}
            <ChevronRight size={18} />
          </span>
        </Link>
        {open.length > 0 && (
          <ul className="divide-y divide-line">
            {open.slice(0, PREVIEW_COUNT).map((item) => (
              <ShoppingRow
                key={item.id}
                item={item}
                addedBy={item.added_by ? memberById.get(item.added_by) : undefined}
                onToggle={() => void toggle(item)}
              />
            ))}
          </ul>
        )}
        {open.length > PREVIEW_COUNT && (
          <p className="pt-2 text-sm text-muted">und {open.length - PREVIEW_COUNT} weitere</p>
        )}
      </Card>
    </>
  )
}
