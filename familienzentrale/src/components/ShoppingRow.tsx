import { Check, X } from 'lucide-react'

import { personColor } from '../lib/colors'
import type { Member, ShoppingItem } from '../lib/types'

interface Props {
  item: ShoppingItem
  addedBy: Member | undefined
  onToggle: () => void
  onRemove?: () => void
}

export function ShoppingRow({ item, addedBy, onToggle, onRemove }: Props) {
  const color = personColor(addedBy?.color)

  return (
    <li className="flex items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={item.done}
        onClick={onToggle}
        className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl text-left"
      >
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 text-white"
          style={{
            borderColor: color.value,
            backgroundColor: item.done ? color.value : 'transparent',
          }}
        >
          {item.done && <Check size={18} strokeWidth={3} />}
        </span>
        <span className={`text-lg ${item.done ? 'text-muted line-through' : ''}`}>{item.name}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`${item.name} entfernen`}
          onClick={onRemove}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-muted"
        >
          <X size={20} />
        </button>
      )}
    </li>
  )
}
