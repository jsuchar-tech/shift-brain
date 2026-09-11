import { useState } from 'react'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useUser
} from '@clerk/clerk-react'

import AuthScreen from './components/AuthScreen'
import Chat from './components/Chat'
import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/ErrorBoundary'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AppContent() {
  const { user } = useUser()
  const [view, setView] = useState('chat')

  const isAdmin = user?.publicMetadata?.role === 'admin'

  return (
    <ErrorBoundary>
      {view === 'dashboard' && isAdmin ? (
        <Dashboard
          onBack={() => setView('chat')}
        />
      ) : (
        <Chat
          onOpenDashboard={
            isAdmin
              ? () => setView('dashboard')
              : null
          }
        />
      )}
    </ErrorBoundary>
  )
}

export default function App() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#fdfbef',
          color: '#0b0b2d',
          fontFamily: 'Arial, Helvetica, sans-serif',
          textAlign: 'center'
        }}
      >
        Missing Clerk publishable key.
      </div>
    )
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
    >
      <SignedOut>
        <AuthScreen />
      </SignedOut>

      <SignedIn>
        <AppContent />
      </SignedIn>
    </ClerkProvider>
  )
}