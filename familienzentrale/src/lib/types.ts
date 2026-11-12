export type MemberRole = 'parent' | 'child'

export interface Family {
  id: string
  name: string
  created_at: string
}

export interface Member {
  id: string
  family_id: string
  user_id: string | null
  name: string
  color: string
  role: MemberRole
  avatar: string | null
  invite_email: string | null
  created_at: string
}

export interface ShoppingItem {
  id: string
  family_id: string
  name: string
  added_by: string | null
  done: boolean
  created_at: string
}

export interface CalendarEvent {
  id: string
  family_id: string
  member_id: string | null
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  source: 'local' | 'ical'
  external_id: string | null
  created_at: string
}

export interface Task {
  id: string
  family_id: string
  assignee_id: string
  title: string
  icon: string | null
  /** YYYY-MM-DD: due day of a one-off task, first day of a recurring one. */
  due_date: string
  /** null, 'FREQ=DAILY' or 'FREQ=WEEKLY;BYDAY=MO,TU,...' */
  recurrence: string | null
  done_at: string | null
  is_kid_task: boolean
  created_at: string
}

export interface Message {
  id: string
  family_id: string
  author_id: string | null
  text: string
  send_push: boolean
  created_at: string
}
