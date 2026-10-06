import { useState } from 'react'
import { useSignIn, useSignUp } from '@clerk/clerk-react'

const SHIFT_LOGO =
  'https://www.figma.com/api/mcp/asset/d5fd5fd5-1b67-4fce-9a0c-cd91c384ab86.png'

const BRAIN =
  'https://www.figma.com/api/mcp/asset/2fc6e0e8-35a1-454c-a00e-b4bef13574c1.png'

const LINE =
  'https://www.figma.com/api/mcp/asset/cf75711b-022a-4f77-8414-2f14dd943f03.svg'

export default function AuthScreen() {
  const { signIn, setActive: setSignInActive } = useSignIn()
  const {
    signUp,
    setActive: setSignUpActive
  } = useSignUp()

  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    country: '',
    email: '',
    password: '',
    code: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  async function handleLogin(e) {
    e.preventDefault()

    if (!form.name || !form.password) return

    setLoading(true)
    setError('')

    try {
      const result = await signIn.create({
        identifier: form.name,
        password: form.password
      })

      await setSignInActive({
        session: result.createdSessionId
      })
    } catch (err) {
      setError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Unable to log in.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSignUp(e) {
    e.preventDefault()

    if (
      !form.name ||
      !form.country ||
      !form.email ||
      !form.password
    ) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await signUp.create({
        firstName: form.name,
        emailAddress: form.email,
        password: form.password,
        unsafeMetadata: {
          country: form.country
        }
      })

      if (result.status === 'complete') {
        await setSignUpActive({
          session: result.createdSessionId
        })
        return
      }

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code'
      })

      setMode('verify')
    } catch (err) {
      setError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Unable to create your account.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleVerification(e) {
    e.preventDefault()

    if (!form.code) return

    setLoading(true)
    setError('')

    try {
      const result =
        await signUp.attemptEmailAddressVerification({
          code: form.code
        })

      if (result.status === 'complete') {
        await setSignUpActive({
          session: result.createdSessionId
        })
      }
    } catch (err) {
      setError(
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        'Invalid verification code.'
      )
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    height: '40px',
    border: 'none',
    borderBottom: '1px solid #0b0b2d',
    outline: 'none',
    background: 'transparent',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: '15px',
    color: '#0b0b2d',
    padding: '0',
    borderRadius: 0
  }

  const placeholderStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: '15px',
    color: '#b7b7b7',
    lineHeight: '34px',
    pointerEvents: 'none'
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#fdfbef',
        color: '#0b0b2d',
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflowX: 'hidden'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '390px',
          minHeight: '783px',
          margin: '0 auto'
        }}
      >
        {/* SHIFT logo */}
        <img
          src={SHIFT_LOGO}
          alt="SHIFT"
          style={{
            position: 'absolute',
            left: '30px',
            top: '30px',
            width: 'auto',
            height: '39px',
            objectFit: 'cover'
          }}
        />

        {/* Hamburger */}
        <button
          type="button"
          aria-label="Menu"
          style={{
            position: 'absolute',
            top: '43px',
            right: '30px',
            width: '24px',
            height: '20px',
            padding: 0,
            border: 0,
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <span
            style={{
              height: '1.4px',
              width: '24px',
              background: '#0b0b2d'
            }}
          />
          <span
            style={{
              height: '1.4px',
              width: '24px',
              background: '#0b0b2d'
            }}
          />
          <span
            style={{
              height: '1.4px',
              width: '24px',
              background: '#0b0b2d'
            }}
          />
        </button>

        {/* Brain */}
        <img
          src={BRAIN}
          alt=""
          style={{
            position: 'absolute',
            width: '91px',
            height: '81px',
            left: '50%',
            top: '123px',
            transform: 'translateX(-50%)',
            objectFit: 'cover'
          }}
        />

        {/* Heading */}
        <div
          style={{
            position: 'absolute',
            left: '30px',
            right: '30px',
            top: '251px',
            height: '33px',
            textAlign: 'center',
            fontSize: '22px',
            lineHeight: '34px',
            fontWeight: 600,
            color: '#000'
          }}
        >
          Hello there!
        </div>

        {/* Intro */}
        <div
          style={{
            position: 'absolute',
            left: '30px',
            top: '309px',
            width: '329px',
            fontSize: '14px',
            lineHeight: '28px',
            color: '#000'
          }}
        >
          <div>
            I’m SHIFT Brain (BETA), a Fun (AI)dult that’s been
            trained on all the resources, tools and knowledge
            gathered over the last 6 years.
          </div>

          <div style={{ height: '28px' }} />

          <strong>
            Ask me anything related to SHIFT!
          </strong>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            {/* Name */}
            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '501px',
                width: '331px',
                height: '40px'
              }}
            >
              {!form.name && (
                <span style={placeholderStyle}>
                  Name
                </span>
              )}

              <input
                value={form.name}
                onChange={e =>
                  update('name', e.target.value)
                }
                style={inputStyle}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '563px',
                width: '331px',
                height: '40px'
              }}
            >
              {!form.password && (
                <span style={placeholderStyle}>
                  Password
                </span>
              )}

              <input
                type="password"
                value={form.password}
                onChange={e =>
                  update('password', e.target.value)
                }
                style={{
                  ...inputStyle,
                  paddingRight: '120px'
                }}
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => {
                  setError('')
                  setMode('forgot')
                }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  height: '34px',
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: '#ff008f',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div
                style={{
                  position: 'absolute',
                  left: '31px',
                  top: '610px',
                  width: '331px',
                  color: '#ff008f',
                  fontSize: '12px'
                }}
              >
                {error}
              </div>
            )}

            {/* Create account */}
            <button
              type="button"
              onClick={() => {
                setError('')
                setMode('signup')
              }}
              style={{
                position: 'absolute',
                left: '31px',
                top: '638px',
                border: 0,
                padding: 0,
                background: 'transparent',
                color: '#ff008f',
                fontSize: '13px',
                lineHeight: '34px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Create an account
            </button>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                position: 'absolute',
                left: '256px',
                top: '631px',
                width: '103px',
                height: '47px',
                border: '2px solid #0b0b2d',
                borderRadius: '20px',
                background: '#ff008f',
                color: '#fff',
                fontSize: '18px',
                fontWeight: 700,
                transform: 'rotate(-6deg)',
                boxShadow: '5px 6px 0 #0b0b2d',
                cursor: loading ? 'wait' : 'pointer'
              }}
            >
              LOG IN
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '501px',
                width: '331px'
              }}
            >
              <input
                placeholder="Name"
                value={form.name}
                onChange={e =>
                  update('name', e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '550px',
                width: '331px'
              }}
            >
              <input
                placeholder="Country"
                value={form.country}
                onChange={e =>
                  update('country', e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '599px',
                width: '331px'
              }}
            >
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={e =>
                  update('email', e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '648px',
                width: '331px'
              }}
            >
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={e =>
                  update('password', e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <button
              type="button"
              onClick={() => setMode('login')}
              style={{
                position: 'absolute',
                left: '31px',
                top: '700px',
                border: 0,
                background: 'transparent',
                color: '#ff008f',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              Back
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                position: 'absolute',
                left: '256px',
                top: '690px',
                width: '103px',
                height: '47px',
                border: '2px solid #0b0b2d',
                borderRadius: '20px',
                background: '#ff008f',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                transform: 'rotate(-6deg)',
                boxShadow: '5px 6px 0 #0b0b2d'
              }}
            >
              SEND
            </button>
          </form>
        )}

        {mode === 'verify' && (
          <form onSubmit={handleVerification}>
            <div
              style={{
                position: 'absolute',
                left: '31px',
                top: '501px',
                width: '331px'
              }}
            >
              <input
                placeholder="Verification code"
                value={form.code}
                onChange={e =>
                  update('code', e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                position: 'absolute',
                left: '256px',
                top: '563px',
                width: '103px',
                height: '47px',
                border: '2px solid #0b0b2d',
                borderRadius: '20px',
                background: '#ff008f',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                transform: 'rotate(-6deg)',
                boxShadow: '5px 6px 0 #0b0b2d'
              }}
            >
              VERIFY
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <div
            style={{
              position: 'absolute',
              left: '31px',
              top: '501px',
              width: '331px'
            }}
          >
            <div
              style={{
                fontSize: '14px',
                lineHeight: '28px',
                color: '#000',
                marginBottom: '20px'
              }}
            >
              Password reset is handled through your
              SHIFT account.
            </div>

            <button
              type="button"
              onClick={() => setMode('login')}
              style={{
                border: 0,
                background: 'transparent',
                color: '#ff008f',
                padding: 0,
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}