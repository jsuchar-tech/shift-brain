import { useState } from 'react'
import {
  ClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
  useUser
} from '@clerk/clerk-react'
import Chat from './components/Chat'
import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/errorBoundary'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AppContent() {
  const { user } = useUser()
  const [view, setView] = useState('chat')
  const isAdmin = user?.publicMetadata?.role === 'admin'

  return (
    <ErrorBoundary>
      {view === 'dashboard' && isAdmin
        ? <Dashboard onBack={() => setView('chat')} />
        : <Chat onOpenDashboard={isAdmin ? () => setView('dashboard') : null} />}
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SignedOut>
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#f7f9fc'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '300', color: '#1a1a2e', marginBottom: '8px' }}>
              Lorem Ipsum 2.0
            </h1>
            <p style={{ color: '#888', fontSize: '14px' }}>Dolor sit amet consectetur adipiscing</p>
          </div>
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn><AppContent /></SignedIn>
    </ClerkProvider>
  )
}
