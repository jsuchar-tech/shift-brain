import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
  useUser
} from '@clerk/clerk-react'
import Chat from './components/Chat'
import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/ErrorBoundary'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AppContent({ clerkPortalId }) {
  const { user } = useUser()
  const [view, setView] = useState('chat')

  const isAdmin = user?.publicMetadata?.role === 'admin'

  return (
    <ErrorBoundary>
      <SignedOut>
        {createPortal(
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#f7f9fc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{
                fontSize: '28px',
                fontWeight: '300',
                color: '#1a1a2e',
                marginBottom: '8px'
              }}>
                SHIFT Brain 2.0
              </h1>
              <p style={{ color: '#888', fontSize: '14px' }}>
                Sign in to access SHIFT's knowledge base
              </p>
            </div>
            <SignIn routing="hash" />
          </div>,
          document.getElementById(clerkPortalId)
        )}
      </SignedOut>
      <SignedIn>
        {view === 'dashboard' && isAdmin
          ? <Dashboard onBack={() => setView('chat')} />
          : <Chat onOpenDashboard={isAdmin ? () => setView('dashboard') : null} />
        }
      </SignedIn>
    </ErrorBoundary>
  )
}

export default function App({ clerkPortalId }) {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AppContent clerkPortalId={clerkPortalId} />
    </ClerkProvider>
  )
}