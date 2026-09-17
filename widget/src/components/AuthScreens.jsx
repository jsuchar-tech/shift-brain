import { useState } from 'react'
import { useSignIn, useSignUp } from '@clerk/clerk-react'

const BRAIN_ASSET = 'https://www.figma.com/api/mcp/asset/03794579-c631-4353-bbb8-fcce3e3805e9.png'

const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')

const COUNTRIES = (() => {
  const names = typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
  return COUNTRY_CODES
    .map(code => names?.of(code) || code)
    .sort((a, b) => a.localeCompare(b))
})()

function clerkError(error, fallback) {
  return error?.errors?.[0]?.longMessage
    || error?.errors?.[0]?.message
    || fallback
}

function AuthLayout({ title, subtitle, children, modifier = '', help = null, brainIcon, theme = {} }) {
  return (
    <div className={`brain-auth ${modifier}`} style={{
      '--cream': theme.color_cream || '#fdfbef',
      '--ink': theme.color_ink || '#0b0b2d',
      '--pink': theme.color_pink || '#ff008f',
      '--purple': theme.color_purple || '#302798',
      '--muted': theme.color_muted || '#b7b7b7',
      '--white': theme.color_white || '#ffffff'
    }}>
      <main className="brain-auth__content">
        <img className="brain-auth__brain" src={brainIcon || BRAIN_ASSET} alt="" />
        <h1>{title}</h1>
        {subtitle && <p className="brain-auth__subtitle">{subtitle}</p>}
        {children}
        {help}
      </main>

      <style>{`
        .brain-auth {
          width: 100%;
          height: auto;
          min-height: 100%;
          overflow: visible;
          background: var(--cream);
          color: var(--ink);
          font-family: Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-auth__content {
          position: relative;
          width: 100%;
          min-height: 789px;
        }

        .brain-auth__brain {
          position: absolute;
          top: 123px;
          left: 50%;
          width: 91px;
          height: 81px;
          transform: translateX(-50%);
          object-fit: cover;
        }

        .brain-auth h1 {
          position: absolute;
          top: 251px;
          left: 30px;
          right: 30px;
          margin: 0;
          color: #000;
          font-size: 22px;
          font-weight: 500;
          line-height: 33px;
          text-align: center;
        }

        .brain-auth__subtitle {
          position: absolute;
          top: 303px;
          left: 50%;
          width: min(407px, calc(100% - 60px));
          margin: 0;
          transform: translateX(-50%);
          color: #595959;
          font-size: 13px;
          line-height: 20px;
          text-align: center;
        }

        .brain-auth__form {
          position: absolute;
          top: 357px;
          left: 50%;
          width: 407px;
          max-width: calc(100% - 60px);
          transform: translateX(-50%);
        }

        .brain-auth__field {
          display: block;
          height: 40px;
          margin: 0 0 23px;
          border-bottom: 1px solid var(--ink);
        }

        .brain-auth__field input,
        .brain-auth__field select {
          width: 100%;
          height: 39px;
          padding: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--ink);
          font: 500 15px/34px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .brain-auth__field select {
          appearance: none;
          cursor: pointer;
          background-image: linear-gradient(45deg, transparent 50%, var(--pink) 50%), linear-gradient(135deg, var(--pink) 50%, transparent 50%);
          background-position: calc(100% - 12px) 17px, calc(100% - 7px) 17px;
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
        }
        .brain-auth__field select:invalid { color: var(--muted); }

        .brain-auth__field input::placeholder { color: var(--muted); opacity: 1; }
        .brain-auth__field input:focus::placeholder { color: #888; }

        .brain-auth__error,
        .brain-auth__notice {
          margin: -10px 0 12px;
          font-size: 12px;
          line-height: 18px;
          text-align: center;
        }

        .brain-auth__error { color: var(--pink); }
        .brain-auth__notice { color: #555; }

        .brain-auth__actions {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          margin-top: 28px;
        }

        .brain-auth__back {
          position: absolute;
          left: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--pink);
          font: 500 13px/34px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          cursor: pointer;
          transition: color 300ms ease-in-out, transform 300ms ease-in-out;
        }

        .brain-auth__back:hover { color: var(--purple); transform: translateX(-3px); }
        .brain-auth__back:active { transform: translateX(-1px) scale(.97); }

        .brain-auth__submit {
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

        .brain-auth__submit::before,
        .brain-auth__submit::after {
          display: none;
        }

        .brain-auth__submit span {
          position: relative;
          z-index: 1;
          display: block;
          color: var(--white);
          font: 700 14px/47px Graphik, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          transform: none;
          white-space: nowrap;
        }

        .brain-auth__submit:hover:not(:disabled) { background: var(--purple); transform: rotate(0deg); }
        .brain-auth__submit:active:not(:disabled) { transform: translate(2px, 2px) rotate(0deg); box-shadow: 2px 2px var(--ink); }
        .brain-auth__submit:disabled { opacity: .6; cursor: default; }
        .brain-auth__captcha { margin-top: -10px; }
        .brain-auth--signup .brain-auth__actions { margin-top: 25px; }
        .brain-auth--forgot .brain-auth__actions { margin-top: 13px; }
        .brain-auth__help {
          position: absolute;
          top: 650px;
          left: 50%;
          width: min(660px, calc(100% - 60px));
          margin: 0;
          transform: translateX(-50%);
          color: var(--ink);
          font-size: 16px;
          line-height: 31px;
          text-align: center;
        }
        .brain-auth__help a { color: var(--pink); text-decoration: none; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        @media (min-width: 768px) {
          .brain-auth__content { min-height: 694px; }
          .brain-auth__brain { top: 28px; }
          .brain-auth h1 { top: 156px; font-size: 30px; line-height: 36px; }
          .brain-auth__subtitle { top: 210px; }
          .brain-auth__field input, .brain-auth__field select { font-size: 18px; }
          .brain-auth--signup .brain-auth__form { top: 262px; }
          .brain-auth--forgot .brain-auth__form { top: 337px; }
          .brain-auth__help { top: 555px; }
        }

        @media (max-width: 767px) {
          .brain-auth__content { min-height: 688px; }
          .brain-auth__brain { top: 28px; }
          .brain-auth h1 { top: 156px; }
          .brain-auth__form { width: 329px; }
          .brain-auth--signup .brain-auth__form { top: 255px; }
          .brain-auth--forgot .brain-auth__form { top: 337px; }
          .brain-auth__help { top: 583px; width: min(330px, calc(100% - 60px)); font-size: 11px; line-height: 20px; }
          .brain-auth__field input, .brain-auth__field select { font-size: 15px; }
          .brain-auth__actions { gap: 24px; }
        }
      `}</style>
    </div>
  )
}

export function CreateAccountScreen({ onBack, brainIcon, theme }) {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [stage, setStage] = useState('details')
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState('')
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function createAccount(event) {
    event.preventDefault()
    if (!isLoaded || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      const names = fullName.trim().split(/\s+/)
      const result = await signUp.create({
        emailAddress,
        password,
        firstName: names.shift() || undefined,
        lastName: names.join(' ') || undefined,
        unsafeMetadata: { country_office: country, approval_required: true }
      })

      // Clerk can complete signups immediately when email verification is
      // disabled. Preparing a verification attempt after that state produces
      // "No sign up attempt was found", even though the user was created.
      if (result.status === 'complete') {
        window.sessionStorage.setItem('shift_brain_registration_pending', '1')
        await setActive({ session: result.createdSessionId })
        return
      }

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setStage('verify')
    } catch (err) {
      setError(clerkError(err, 'Unable to create your account. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function verifyAccount(event) {
    event.preventDefault()
    if (!isLoaded || isSubmitting) return

    setError('')
    setIsSubmitting(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({ code })
      if (result.status === 'complete') {
        window.sessionStorage.setItem('shift_brain_registration_pending', '1')
        await setActive({ session: result.createdSessionId })
        return
      }
      setError('Additional verification is required to finish creating your account.')
    } catch (err) {
      setError(clerkError(err, 'The verification code is invalid or expired.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={stage === 'verify' ? 'Verify your email' : 'Create an account'}
      subtitle={stage === 'verify' ? `Enter the verification code sent to ${emailAddress}.` : ''}
      modifier="brain-auth--signup"
      brainIcon={brainIcon}
      theme={theme}
    >
      <form className="brain-auth__form" onSubmit={stage === 'verify' ? verifyAccount : createAccount}>
        {stage === 'details' ? (
          <>
            <label className="brain-auth__field"><span className="sr-only">Name</span><input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Name" autoComplete="name" required /></label>
            <label className="brain-auth__field"><span className="sr-only">Country</span><select value={country} onChange={event => setCountry(event.target.value)} autoComplete="country-name" required><option value="" disabled>Country</option>{COUNTRIES.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="brain-auth__field"><span className="sr-only">Email</span><input type="email" value={emailAddress} onChange={event => setEmailAddress(event.target.value)} placeholder="Email" autoComplete="email" required /></label>
            <label className="brain-auth__field"><span className="sr-only">Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" autoComplete="new-password" required /></label>
            <div id="clerk-captcha" className="brain-auth__captcha" />
          </>
        ) : (
          <label className="brain-auth__field"><span className="sr-only">Verification code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="Verification code" inputMode="numeric" autoComplete="one-time-code" required /></label>
        )}

        {error && <p className="brain-auth__error" role="alert">{error}</p>}

        <div className="brain-auth__actions">
          <button className="brain-auth__back" type="button" onClick={onBack}>Back to log in</button>
          <button className="brain-auth__submit" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'WAIT' : stage === 'verify' ? 'VERIFY' : 'SEND'}</span>
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordScreen({ onBack, brainIcon, theme }) {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [stage, setStage] = useState('request')
  const [emailAddress, setEmailAddress] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function sendResetCode(event) {
    event.preventDefault()
    if (!isLoaded || isSubmitting) return

    setError('')
    setIsSubmitting(true)
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress
      })
      setStage('reset')
    } catch (err) {
      setError(clerkError(err, 'Unable to send the password reset code.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resetPassword(event) {
    event.preventDefault()
    if (!isLoaded || isSubmitting) return
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password
      })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        return
      }
      setError('Additional verification is required to finish resetting your password.')
    } catch (err) {
      setError(clerkError(err, 'Unable to reset your password. Check the code and try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={stage === 'request' ? 'Forgot your password?' : 'Create a new password'}
      subtitle={stage === 'request'
        ? ''
        : `Enter the code sent to ${emailAddress} and choose a new password.`}
      modifier="brain-auth--forgot"
      brainIcon={brainIcon}
      theme={theme}
      help={stage === 'request' ? (
        <p className="brain-auth__help">
          If you are still having problems, just send us an email and we will sort it out for you!{' '}
          <a href="mailto:hello@shiftnow.org">hello@shiftnow.org</a>
        </p>
      ) : null}
    >
      <form className="brain-auth__form" onSubmit={stage === 'request' ? sendResetCode : resetPassword}>
        {stage === 'request' ? (
          <label className="brain-auth__field"><span className="sr-only">Email</span><input type="email" value={emailAddress} onChange={event => setEmailAddress(event.target.value)} placeholder="Email" autoComplete="email" required /></label>
        ) : (
          <>
            <label className="brain-auth__field"><span className="sr-only">Reset code</span><input value={code} onChange={event => setCode(event.target.value)} placeholder="Reset code" inputMode="numeric" autoComplete="one-time-code" required /></label>
            <label className="brain-auth__field"><span className="sr-only">New password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="New password" autoComplete="new-password" required /></label>
            <label className="brain-auth__field"><span className="sr-only">Confirm new password</span><input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Confirm new password" autoComplete="new-password" required /></label>
          </>
        )}

        {error && <p className="brain-auth__error" role="alert">{error}</p>}

        <div className="brain-auth__actions">
          <button className="brain-auth__back" type="button" onClick={onBack}>Back to log in</button>
          <button className="brain-auth__submit" type="submit" disabled={isSubmitting}>
            <span>{isSubmitting ? 'WAIT' : stage === 'request' ? 'SEND' : 'RESET'}</span>
          </button>
        </div>
      </form>
    </AuthLayout>
  )
}
