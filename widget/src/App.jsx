import { useCallback, useEffect, useState } from 'react'
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useAuth,
  useSignIn,
  useUser
} from '@clerk/clerk-react'
import Chat from './components/Chat'
import Dashboard from './components/Dashboard'
import ErrorBoundary from './components/errorBoundary'
import { CreateAccountScreen, ForgotPasswordScreen } from './components/AuthScreens'
import { API_URL, syncUser } from './lib/api'
import { DEFAULT_SETTINGS } from './config/settings'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AppContent({ settings, onSettingsChange }) {
  const { getToken, signOut } = useAuth()
  const { user } = useUser()
  const [view, setView] = useState('chat')
  const [localUser, setLocalUser] = useState(null)
  const [accessState, setAccessState] = useState('checking')
  const [accessError, setAccessError] = useState('')

  const refreshAccess = useCallback(async () => {
    if (!user) return
    try {
      setAccessError('')
      const metadata = user.publicMetadata || {}
      const signupMetadata = user.unsafeMetadata || {}
      const registrationPending = window.sessionStorage.getItem('shift_brain_registration_pending') === '1'
      const data = await syncUser(getToken, {
        full_name: user.fullName || user.firstName,
        work_email: user.primaryEmailAddress?.emailAddress,
        country_office: metadata.country_office || signupMetadata.country_office || 'Unknown',
        shifter_year: metadata.shifter_year || signupMetadata.shifter_year || 1,
        registration_pending: registrationPending
      })
      setLocalUser(data.user)
      if (!data.user?.is_active) {
        window.sessionStorage.removeItem('shift_brain_registration_pending')
      }
      setAccessState(data.user?.is_active ? 'approved' : 'pending')
    } catch (error) {
      console.error('Failed to check account approval:', error)
      setAccessError(error.message || 'The account could not be synchronized.')
      setAccessState('error')
    }
  }, [getToken, user])

  useEffect(() => {
    if (!user) return undefined
    refreshAccess()
  }, [user, refreshAccess])

  useEffect(() => {
    if (accessState !== 'pending') return undefined
    const timer = window.setInterval(refreshAccess, 15000)
    return () => window.clearInterval(timer)
  }, [accessState, refreshAccess])

  const isAdmin = localUser?.role === 'admin' || user?.publicMetadata?.role === 'admin'

  if (accessState !== 'approved') {
    const copy = { ...DEFAULT_SETTINGS, ...(settings || {}) }
    return (
      <div
        className="brain-approval"
        style={{
          '--cream': copy.color_cream,
          '--ink': copy.color_ink,
          '--pink': copy.color_pink,
          '--purple': copy.color_purple
        }}
      >
        <img src={copy.brain_icon_url || DEFAULT_SETTINGS.brain_icon_url} alt="" />
        {accessState === 'checking' && <><h1>Checking your account…</h1><p>Please wait a moment.</p></>}
        {accessState === 'pending' && <><h1>{copy.signup_pending_heading}</h1><p>{copy.signup_pending_message}</p></>}
        {accessState === 'error' && <><h1>We couldn’t check your account</h1><p>{accessError} Please try again or return to the login screen.</p></>}
        <div className="brain-approval__actions">
          {accessState !== 'checking' && <button type="button" onClick={refreshAccess}>Check again</button>}
          <button type="button" onClick={() => signOut().then(() => window.location.reload())}>Back to login</button>
        </div>
        <style>{`
          .brain-approval { min-height: 694px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 60px 30px; background: var(--cream); color: var(--ink); text-align: center; font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .brain-approval img { width: 91px; height: 81px; object-fit: contain; }
          .brain-approval h1 { margin: 16px 0 0; font-size: 30px; line-height: 38px; font-weight: 500; }
          .brain-approval p { width: min(520px, 100%); margin: 0; font-size: 15px; line-height: 27px; }
          .brain-approval__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 12px; }
          .brain-approval button { min-height: 42px; padding: 0 18px; border: 2px solid var(--ink); border-radius: 50px; background: var(--pink); box-shadow: 4px 4px var(--ink); color: #fff; font-weight: 700; cursor: pointer; transform: rotate(-2deg); }
          .brain-approval button:hover { background: var(--purple); transform: rotate(0); }
          .brain-approval button:active { box-shadow: 2px 2px var(--ink); transform: translate(2px, 2px); }
        `}</style>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      {view === 'dashboard' && isAdmin
        ? <Dashboard onBack={() => setView('chat')} settings={settings} onSettingsChange={onSettingsChange} />
        : <Chat onOpenDashboard={isAdmin ? () => setView('dashboard') : null} settings={settings} currentUser={localUser} />}
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
    <div className="brain-login" style={{
      '--cream': copy.color_cream,
      '--ink': copy.color_ink,
      '--pink': copy.color_pink,
      '--purple': copy.color_purple,
      '--muted': copy.color_muted,
      '--white': copy.color_white,
      '--line': copy.color_line,
      '--danger': copy.color_danger
    }}>
      <main className="brain-login__content">
        <img src={copy.brain_icon_url || DEFAULT_SETTINGS.brain_icon_url} alt="" className="brain-login__brain" />
        <h1>{copy.login_heading}</h1>

        <div className="brain-login__intro">
          <p>{copy.login_intro}</p>
          <p className="brain-login__intro-strong">{copy.login_emphasis}</p>
        </div>

        <form className="brain-login__form" onSubmit={handleSubmit}>
          <label className="brain-login__field">
            <span className="sr-only">Email</span>
            <input
              type="email"
              value={identifier}
              onChange={event => setIdentifier(event.target.value)}
              placeholder={copy.login_email_placeholder || 'Email'}
              autoComplete="email"
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
          position: relative;
          height: auto;
          min-height: 100%;
          width: 100%;
          overflow: visible;
          background: var(--cream);
          color: var(--ink);
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
          border-bottom: 1px solid var(--ink);
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
          transition: color 300ms ease-in-out, transform 300ms ease-in-out;
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
          transition: color 300ms ease-in-out, transform 300ms ease-in-out;
        }

        .brain-login__forgot:hover,
        .brain-login__create:hover { color: var(--purple); transform: translateY(-1px); }
        .brain-login__forgot:active,
        .brain-login__create:active { transform: translateY(1px) scale(.98); }

        .brain-login__submit {
          position: relative;
          width: 103px;
          height: 47px;
          padding: 0;
          border: 2px solid var(--ink);
          border-radius: 50px;
          background: var(--pink);
          box-shadow: 4px 4px var(--ink);
          color: var(--white);
          transform: rotate(-3deg);
          transition: background-color 300ms ease-in-out, transform 300ms ease-in-out, box-shadow 300ms ease-in-out;
          cursor: pointer;
        }

        .brain-login__submit::before,
        .brain-login__submit::after {
          display: none;
        }

        .brain-login__submit span {
          position: relative;
          z-index: 1;
          display: block;
          color: var(--white);
          font: 700 18px/47px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          transform: none;
        }

        .brain-login__submit:hover:not(:disabled) { background: var(--purple); transform: rotate(0deg); }
        .brain-login__submit:active:not(:disabled) { transform: translate(2px, 2px) rotate(0deg); box-shadow: 2px 2px var(--ink); }
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

        @media (max-width: 767px) {
          .brain-login__content { min-height: 688px; }
          .brain-login__brain { top: 28px; }
          .brain-login h1 { top: 156px; }
          .brain-login__intro { top: 214px; }
          .brain-login__form { top: 405px; }
        }
      `}</style>
    </div>
  )
}

function SignedOutFlow({ settings }) {
  const [view, setView] = useState('login')

  useEffect(() => {
    const host = document.getElementById('shift-brain-root')
    if (!host) return undefined

    const previous = {
      height: host.style.height,
      minHeight: host.style.minHeight,
      overflow: host.style.overflow
    }

    // Authentication screens may be taller than the available chat viewport.
    // Let them contribute to the Squarespace page height and use its scrollbar.
    host.style.height = 'auto'
    host.style.minHeight = '694px'
    host.style.overflow = 'visible'

    return () => {
      host.style.height = previous.height
      host.style.minHeight = previous.minHeight
      host.style.overflow = previous.overflow
    }
  }, [])

  if (view === 'create-account') {
    return <CreateAccountScreen onBack={() => setView('login')} brainIcon={settings?.brain_icon_url} theme={settings} />
  }

  if (view === 'forgot-password') {
    return <ForgotPasswordScreen onBack={() => setView('login')} brainIcon={settings?.brain_icon_url} theme={settings} />
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
    const controller = new AbortController()

    fetch(`${API_URL}/config`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data?.settings) {
          setSettings(current => ({ ...current, ...data.settings }))
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError') console.warn('Using default settings:', error)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SignedOut><SignedOutFlow settings={settings} /></SignedOut>
      <SignedIn><AppContent settings={settings} onSettingsChange={next => setSettings(current => ({ ...current, ...next }))} /></SignedIn>
    </ClerkProvider>
  )
}
