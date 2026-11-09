import { Check } from 'lucide-react'

import { PERSON_COLORS } from '../lib/colors'

export function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Farbe" className="flex gap-3">
      {PERSON_COLORS.map((color) => {
        const selected = color.value === value
        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.label}
            onClick={() => onChange(color.value)}
            className="flex size-12 items-center justify-center rounded-full text-white"
            style={{
              backgroundColor: color.value,
              boxShadow: selected ? `0 0 0 3px #fff, 0 0 0 5px ${color.value}` : undefined,
            }}
          >
            {selected && <Check size={22} strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
}
