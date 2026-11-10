import { Check, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button, ErrorNote, TextInput } from '../../components/ui'
import { useFamily } from '../../context/family'
import { useShoppingList } from '../../hooks/useShoppingList'
import { personColor } from '../../lib/colors'

export function PanelShopping() {
  const { family, me, members } = useFamily()
  const { items, loading, error, add, toggle, remove, clearDone } = useShoppingList(family.id, me.id)
  const [name, setName] = useState('')

  const memberById = new Map(members.map((m) => [m.id, m]))
  // Open items first, finished ones at the end.
  const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done))
  const doneCount = items.filter((i) => i.done).length

  function submit(event: FormEvent) {
    event.preventDefault()
    void add(name)
    setName('')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-5">
        <h1 className="font-display text-4xl font-bold">Einkauf</h1>
        {doneCount > 0 && (
          <Button variant="secondary" onClick={() => void clearDone()}>
            Erledigte entfernen ({doneCount})
          </Button>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-3">
        <TextInput
          aria-label="Neuer Artikel"
          placeholder="Was fehlt?"
          maxLength={120}
          enterKeyHint="done"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-16 !text-xl"
        />
        <Button type="submit" aria-label="Hinzufügen" disabled={!name.trim()} className="min-h-16 !px-6">
          <Plus size={28} />
        </Button>
      </form>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-lg text-muted">Lädt …</p>
      ) : items.length === 0 ? (
        <p className="text-xl text-muted">Die Liste ist leer. Alles da!</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {sorted.map((item) => {
            const color = personColor(item.added_by ? memberById.get(item.added_by)?.color : null).value
            return (
              <li key={item.id} className="flex items-center rounded-2xl border border-line bg-card pl-4">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  onClick={() => void toggle(item)}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border-2 text-white"
                    style={{ borderColor: color, backgroundColor: item.done ? color : 'transparent' }}
                  >
                    {item.done && <Check size={22} strokeWidth={3} />}
                  </span>
                  <span className={`truncate text-xl ${item.done ? 'text-muted line-through' : ''}`}>
                    {item.name}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${item.name} entfernen`}
                  onClick={() => void remove(item)}
                  className="flex size-14 shrink-0 items-center justify-center text-muted"
                >
                  <X size={22} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
