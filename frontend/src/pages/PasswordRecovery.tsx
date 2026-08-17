import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { NewPasswordFields } from '../components/NewPasswordFields'
import { AsyncState } from '../components/ui'
import { useApi } from '../hooks/api'
import { api, ApiError, errorMessage } from '../utils/api'

export function ForgotPassword() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const signIn = next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const email = new FormData(event.currentTarget).get('email')
    setBusy(true)
    setError('')
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email } })
      setSent(true)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <div className="container account-wrap">
    <section className="panel account-panel">
      <p className="eyebrow">RIDEON account</p>
      <h1>Forgot your password?</h1>
      <p>Enter the email address for your RIDEON account.</p>
      {sent ? <div className="account-feedback form-success" role="status">
        <p>If an account exists for that email, you’ll receive a reset link. Open the link in this browser.</p>
      </div> : <form className="contact-form" onSubmit={send} onChange={() => setError('')}>
        <label className="field"><span>Email address</span><input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="button primary w-full" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>}
      <p className="account-switch"><Link to={signIn}>Back to sign in</Link></p>
    </section>
  </div>
}

export function ResetPassword() {
  const session = useApi<{ ready: boolean }>('/api/auth/recovery/session')
  const [busy, setBusy] = useState(false)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState('')

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const password = form.get('password')
    const confirmPassword = form.get('confirmPassword')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    setError('')
    try {
      await api('/api/auth/recovery/password', { method: 'POST', body: { password, confirmPassword } })
      // Reload the application after the server clears the old sign-in cookies.
      window.location.replace('/sign-in?reset=complete')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setExpired(true)
      else setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <div className="container account-wrap">
    <section className="panel account-panel">
      <p className="eyebrow">RIDEON account</p>
      <h1>Set a new password</h1>
      {session.loading || session.error ? <AsyncState error={session.error} onRetry={session.reload} label="Checking your reset link…" /> :
        !session.data?.ready || expired ? <>
          <p>Your reset link has expired or was opened in a different browser.</p>
          <p className="account-switch"><Link to="/forgot-password">Request a new reset link</Link></p>
        </> : <form className="contact-form" onSubmit={reset} onChange={() => setError('')}>
          <NewPasswordFields label="New password" />
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button primary w-full" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>}
      <p className="account-switch"><Link to="/sign-in">Back to sign in</Link></p>
    </section>
  </div>
}
