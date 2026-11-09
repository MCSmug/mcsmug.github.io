import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { PageTitle } from '../components/AppShell'
import { ShoppingRow } from '../components/ShoppingRow'
import { Button, Card, ErrorNote, TextInput } from '../components/ui'
import { useFamily } from '../context/family'
import { useShoppingList } from '../hooks/useShoppingList'

export function Shopping() {
  const { family, me, members } = useFamily()
  const { items, loading, error, add, toggle, remove, clearDone } = useShoppingList(family.id, me.id)
  const [name, setName] = useState('')

  const open = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const memberById = new Map(members.map((m) => [m.id, m]))

  function submit(event: FormEvent) {
    event.preventDefault()
    void add(name)
    setName('')
  }

  return (
    <>
      <PageTitle>Einkauf</PageTitle>

      <form onSubmit={submit} className="mb-4 flex gap-2">
        <TextInput
          aria-label="Neuer Artikel"
          placeholder="Was fehlt?"
          maxLength={120}
          enterKeyHint="done"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" aria-label="Hinzufügen" disabled={!name.trim()} className="px-4">
          <Plus size={22} />
        </Button>
      </form>

      {error && (
        <div className="mb-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Lädt …</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-muted">Die Liste ist leer. Alles da!</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {open.length > 0 && (
            <Card className="py-2">
              <ul className="divide-y divide-line">
                {open.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    addedBy={item.added_by ? memberById.get(item.added_by) : undefined}
                    onToggle={() => void toggle(item)}
                    onRemove={() => void remove(item)}
                  />
                ))}
              </ul>
            </Card>
          )}

          {done.length > 0 && (
            <Card className="py-2">
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-sm font-semibold text-muted">Erledigt ({done.length})</h2>
                <button
                  type="button"
                  onClick={() => void clearDone()}
                  className="min-h-12 px-2 text-sm font-semibold underline"
                >
                  Erledigte entfernen
                </button>
              </div>
              <ul className="divide-y divide-line">
                {done.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    addedBy={item.added_by ? memberById.get(item.added_by) : undefined}
                    onToggle={() => void toggle(item)}
                    onRemove={() => void remove(item)}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
