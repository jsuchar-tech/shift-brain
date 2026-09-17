import { useEffect, useState } from 'react'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useSignIn,
  useUser
} from '@clerk/clerk-react'
import Chat from './components/Chat'
import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/errorBoundary'
import { CreateAccountScreen, ForgotPasswordScreen } from './components/AuthScreens'
import { API_URL } from './lib/api'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const DEFAULT_SETTINGS = {
  logo_url: 'https://www.figma.com/api/mcp/asset/44867e92-d100-4ce0-825a-f3eb32f0a8d0.png',
  login_heading: 'Hello there!',
  login_intro: 'I’m SHIFT Brain (BETA), a Fun (AI)dult that’s been trained on all the resources, tools and knowledge gathered over the last 6 years.',
  login_emphasis: 'Ask me anything related to SHIFT!',
  login_name_placeholder: 'Name',
  login_password_placeholder: 'Password',
  login_forgot_password: 'Forgot password?',
  login_create_account: 'Create an account',
  login_button: 'LOG IN',
  dashboard_title: 'Curator Dashboard',
  dashboard_back_to_chat: '← Back to chat',
  dashboard_participants: 'Participants',
  dashboard_conversations: 'Conversations',
  dashboard_knowledge: 'Knowledge base',
  dashboard_usage: 'Usage stats',
  dashboard_settings: 'Settings',
  chat_welcome: 'Let’s start building your movement today!'
}

const LOGIN_ASSETS = {
  brain: 'https://www.figma.com/api/mcp/asset/03794579-c631-4353-bbb8-fcce3e3805e9.png'
}

function AppContent({ settings, onSettingsChange }) {
  const { user } = useUser()
  const [view, setView] = useState('chat')
  const isAdmin = user?.publicMetadata?.role === 'admin'

  return (
    <ErrorBoundary>
      {view === 'dashboard' && isAdmin
        ? <Dashboard onBack={() => setView('chat')} settings={settings} onSettingsChange={onSettingsChange} />
        : <Chat onOpenDashboard={isAdmin ? () => setView('dashboard') : null} settings={settings} />}
    </ErrorBoundary>
  )
}

function ClerkLogin({ settings, onForgotPassword, onCreateAccount }) {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isLoaded) return null

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await signIn.create({ identifier, password })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        return
      }

      setError('Additional verification is required to finish signing in.')
    } catch (err) {
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message
      setError(message || 'Unable to log in. Please check your details and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const copy = { ...DEFAULT_SETTINGS, ...(settings || {}) }

  return (
    <div className="brain-login">
      <main className="brain-login__content">
        <img src={LOGIN_ASSETS.brain} alt="" className="brain-login__brain" />
        <h1>{copy.login_heading}</h1>

        <div className="brain-login__intro">
          <p>{copy.login_intro}</p>
          <p className="brain-login__intro-strong">{copy.login_emphasis}</p>
        </div>

        <form className="brain-login__form" onSubmit={handleSubmit}>
          <label className="brain-login__field">
            <span className="sr-only">Name</span>
            <input
              type="text"
              value={identifier}
              onChange={event => setIdentifier(event.target.value)}
              placeholder={copy.login_name_placeholder}
              autoComplete="username"
              required
            />
          </label>

          <label className="brain-login__field brain-login__password-field">
            <span className="sr-only">Password</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={copy.login_password_placeholder}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="brain-login__forgot"
              onClick={onForgotPassword}
            >
              {copy.login_forgot_password}
            </button>
          </label>

          {error && <p className="brain-login__error" role="alert">{error}</p>}

          <div className="brain-login__actions">
            <button type="button" className="brain-login__create" onClick={onCreateAccount}>{copy.login_create_account}</button>
            <button className="brain-login__submit" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? 'LOGGING IN' : copy.login_button}</span>
            </button>
          </div>
        </form>
      </main>

      <style>{`
        .brain-login {
          --cream: #fdfbef;
          --ink: #0b0b2d;
          --pink: #ff008f;
          --muted: #b7b7b7;
          position: relative;
          height: 100%;
          min-height: 0;
          width: 100%;
          overflow-y: auto;
          background: var(--cream);
          color: #000;
          font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-login__content {
          position: relative;
          width: 100%;
          min-height: 789px;
        }

        .brain-login__brain {
          position: absolute;
          top: 123px;
          left: 50%;
          width: 91px;
          height: 81px;
          transform: translateX(-50%);
          object-fit: cover;
        }

        .brain-login h1 {
          position: absolute;
          top: 251px;
          left: 30px;
          right: 30px;
          margin: 0;
          font-size: 22px;
          line-height: 34px;
          font-weight: 500;
          text-align: center;
        }

        .brain-login__intro {
          position: absolute;
          top: 309px;
          left: 30px;
          width: calc(100% - 60px);
          max-width: 802px;
          font-size: 14px;
          line-height: 28px;
        }

        .brain-login__intro p { margin: 0; }
        .brain-login__intro-strong { margin-top: 28px !important; font-weight: 600; }

        .brain-login__form {
          position: absolute;
          top: 501px;
          left: 31px;
          width: 331px;
          max-width: calc(100% - 62px);
        }

        .brain-login__field {
          position: relative;
          display: block;
          height: 40px;
          margin: 0 0 22px;
          border-bottom: 1px solid #0b0b2d;
        }

        .brain-login__field input {
          width: 100%;
          height: 39px;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--ink);
          font: 500 15px/34px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-login__field input::placeholder { color: var(--muted); opacity: 1; }
        .brain-login__field input:focus::placeholder { color: #888; }

        .brain-login__password-field { margin-bottom: 0; }

        .brain-login__forgot {
          position: absolute;
          right: 0;
          top: 0;
          height: 34px;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--pink);
          font: 500 13px/34px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
        }

        .brain-login__error {
          margin: 10px 0 0;
          color: var(--pink);
          font-size: 12px;
          line-height: 18px;
        }

        .brain-login__actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 28px;
        }

        .brain-login__create {
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--pink);
          font: 500 13px/34px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-decoration: none;
          cursor: pointer;
        }

        .brain-login__submit {
          position: relative;
          width: 103px;
          height: 47px;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .brain-login__submit::before,
        .brain-login__submit::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          transform: rotate(-6deg) skewX(-2deg);
        }

        .brain-login__submit::before {
          background: var(--ink);
          transform: translate(5px, 6px) rotate(-6deg) skewX(-2deg);
        }

        .brain-login__submit::after {
          background: var(--pink);
          border: 2px solid var(--ink);
        }

        .brain-login__submit span {
          position: relative;
          z-index: 1;
          display: block;
          color: #fff;
          font: 700 18px/47px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          transform: rotate(-6deg) skewX(-2deg);
        }

        .brain-login__submit:disabled { opacity: .65; cursor: default; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        @media (min-width: 768px) {
          .brain-login__content { min-height: 694px; }
          .brain-login__brain { top: 28px; }
          .brain-login h1 { top: 156px; font-size: 30px; line-height: 36px; }
          .brain-login__intro {
            top: 214px;
            left: 50%;
            width: 407px;
            max-width: calc(100% - 60px);
            transform: translateX(-50%);
            font-size: 16px;
            line-height: 31px;
          }
          .brain-login__form {
            top: 424px;
            left: 50%;
            width: 407px;
            transform: translateX(-50%);
          }
        }

        @media (max-width: 380px) {
          .brain-login__form { left: 30px; width: calc(100% - 60px); max-width: none; }
          .brain-login__intro { left: 30px; width: calc(100% - 60px); }
          .brain-login__forgot { font-size: 12px; }
        }
      `}</style>
    </div>
  )
}

function SignedOutFlow({ settings }) {
  const [view, setView] = useState('login')

  if (view === 'create-account') {
    return <CreateAccountScreen onBack={() => setView('login')} />
  }

  if (view === 'forgot-password') {
    return <ForgotPasswordScreen onBack={() => setView('login')} />
  }

  return (
    <ClerkLogin
      settings={settings}
      onForgotPassword={() => setView('forgot-password')}
      onCreateAccount={() => setView('create-account')}
    />
  )
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/config`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data?.settings) {
          setSettings(current => ({ ...current, ...data.settings }))
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [])

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SignedOut><SignedOutFlow settings={settings} /></SignedOut>
      <SignedIn><AppContent settings={settings} onSettingsChange={next => setSettings(current => ({ ...current, ...next }))} /></SignedIn>
    </ClerkProvider>
  )
}
