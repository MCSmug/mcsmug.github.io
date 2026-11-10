import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { Button, FullScreenMessage } from './components/ui'
import { AuthProvider, useAuth } from './context/auth'
import { FamilyProvider, useFamilyState } from './context/family'
import { isSupabaseConfigured } from './lib/supabase'
import { Calendar } from './pages/Calendar'
import { ComingSoon } from './pages/ComingSoon'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Settings } from './pages/Settings'
import { Shopping } from './pages/Shopping'

function FamilyGate() {
  const { session } = useAuth()
  const { state, reload } = useFamilyState()

  if (state.status === 'loading') return <FullScreenMessage title="Lädt …" />
  if (state.status === 'error') {
    return (
      <FullScreenMessage title="Keine Verbindung">
        <p className="text-muted">Die Familie konnte nicht geladen werden.</p>
        <Button onClick={() => void reload()}>Noch einmal versuchen</Button>
      </FullScreenMessage>
    )
  }
  if (state.status === 'none') return <Onboarding email={session?.user.email} />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Calendar />} />
        <Route
          path="aufgaben"
          element={<ComingSoon title="Aufgaben" text="Aufgaben und der Kindermodus folgen im nächsten Schritt." />}
        />
        <Route path="einkauf" element={<Shopping />} />
        <Route
          path="familie"
          element={<ComingSoon title="Familie" text="Der Familien-Chat folgt in einem späteren Schritt." />}
        />
        <Route path="einstellungen" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function AuthGate() {
  const { loading, session } = useAuth()

  if (loading) return <FullScreenMessage title="Lädt …" />
  if (!session) return <Login />

  return (
    <FamilyProvider userId={session.user.id}>
      <FamilyGate />
    </FamilyProvider>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <FullScreenMessage title="Supabase ist noch nicht eingerichtet">
        <p className="text-muted">
          Lege die Datei <code>.env.local</code> nach dem Muster von <code>.env.example</code> an und
          starte die App neu.
        </p>
      </FullScreenMessage>
    )
  }

  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
