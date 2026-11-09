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
