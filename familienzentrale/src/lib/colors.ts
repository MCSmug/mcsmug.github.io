export interface PersonColor {
  value: string
  tint: string
  label: string
}

export const PERSON_COLORS: PersonColor[] = [
  { value: '#2563EB', tint: '#E3ECFD', label: 'Blau' },
  { value: '#EA580C', tint: '#FDEBDD', label: 'Orange' },
  { value: '#0F766E', tint: '#DDF1EE', label: 'Grün' },
  { value: '#7C3AED', tint: '#EDE5FD', label: 'Violett' },
]

// Used for entries that concern the whole family.
const NEUTRAL: PersonColor = { value: '#44403A', tint: '#ECE8E0', label: 'Neutral' }

export function personColor(value: string | null | undefined): PersonColor {
  if (!value) return NEUTRAL
  return (
    PERSON_COLORS.find((c) => c.value.toLowerCase() === value.toLowerCase()) ?? {
      ...NEUTRAL,
      value,
    }
  )
}
