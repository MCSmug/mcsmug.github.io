import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { supabase } from '../lib/supabase'
import type { Family, Member } from '../lib/types'

type FamilyState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'none' }
  | { status: 'ready'; family: Family; me: Member; members: Member[] }

interface FamilyContextValue {
  state: FamilyState
  reload: () => Promise<void>
}

const FamilyContext = createContext<FamilyContextValue | null>(null)

async function loadFamily(userId: string): Promise<FamilyState> {
  // Link this account to a member a parent invited by e-mail (no-op otherwise).
  const claim = await supabase.rpc('claim_invites')
  if (claim.error) return { status: 'error', message: claim.error.message }

  const own = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
  if (own.error) return { status: 'error', message: own.error.message }
  const me = own.data[0] as Member | undefined
  if (!me) return { status: 'none' }

  const [family, members] = await Promise.all([
    supabase.from('families').select('*').eq('id', me.family_id).single(),
    supabase.from('members').select('*').eq('family_id', me.family_id).order('created_at'),
  ])
  if (family.error) return { status: 'error', message: family.error.message }
  if (members.error) return { status: 'error', message: members.error.message }

  return {
    status: 'ready',
    family: family.data as Family,
    me,
    members: members.data as Member[],
  }
}

export function FamilyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<FamilyState>({ status: 'loading' })

  const reload = useCallback(async () => {
    setState(await loadFamily(userId))
  }, [userId])

  useEffect(() => {
    let cancelled = false
    loadFamily(userId).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Keep the member list in sync across devices.
  const familyId = state.status === 'ready' ? state.family.id : null
  useEffect(() => {
    if (!familyId) return
    const channel = supabase
      .channel(`members:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => {
        void reload()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [familyId, reload])

  return <FamilyContext.Provider value={{ state, reload }}>{children}</FamilyContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useFamilyState() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamilyState must be used inside FamilyProvider')
  return ctx
}

/** For pages that are only rendered once the family is loaded. */
// eslint-disable-next-line react/only-export-components
export function useFamily() {
  const { state, reload } = useFamilyState()
  if (state.status !== 'ready') throw new Error('Family is not loaded')
  return { family: state.family, me: state.me, members: state.members, reload }
}
