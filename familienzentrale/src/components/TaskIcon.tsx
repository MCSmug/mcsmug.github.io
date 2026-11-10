import type { LucideProps } from 'lucide-react'
import { createElement } from 'react'

import { FALLBACK_TASK_ICON, TASK_ICONS } from '../lib/taskIcons'

/** Renders the picture for an icon key (a star when the key is unknown). */
export function TaskIcon({ icon, ...props }: { icon: string | null } & LucideProps) {
  return createElement(TASK_ICONS.find((i) => i.key === icon)?.icon ?? FALLBACK_TASK_ICON, props)
}
