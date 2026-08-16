import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, errorMessage } from '../utils/api'

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
