import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { NewPasswordFields } from '../components/NewPasswordFields'
import { AsyncState, EmptyState } from '../components/ui'
import { useAuth } from '../hooks/auth'
import { authReturnPath } from '../../../shared/auth.ts'
import type { Account } from '../../../shared/types.ts'
import { api, errorMessage } from '../utils/api'

function destination(next: string | null, role: Account['role']) {
  return next ?? (role === 'admin' ? '/admin' : '/my-bookings')
}

export function AccountPage({ register = false }: { register?: boolean }) {
  const auth = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'email' | 'google' | null>(null)
  const [error, setError] = useState('')
  const [googleError, setGoogleError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const next = authReturnPath(params.get('next'))
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ''
  const authStatus = params.get('auth')
  const admin = next === '/admin'
  const hosting = next === '/host' || next?.startsWith('/host?')
  const title = register ? hosting ? 'Create a host account' : 'Create your RIDEON account' : admin ? 'Staff sign in' : hosting ? 'Sign in to host' : 'Sign in to RIDEON'
  if (auth.account) return <Navigate to={destination(next, auth.account.role)} replace />

  async function continueWithGoogle() {
    if (busy) return
    setBusy('google')
    setError('')
    setGoogleError('')
    try {
      const { url } = await api<{ url: string }>('/api/auth/google/start', { method: 'POST', body: { next } })
      window.location.assign(url)
    } catch (error) {
      setGoogleError(errorMessage(error))
      setBusy(null)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const details = new FormData(event.currentTarget)
    const email = String(details.get('email'))
    const password = String(details.get('password'))
    const confirmPassword = String(details.get('confirmPassword') ?? '')
    if (register && password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy('email')
    setError('')
    setGoogleError('')
    try {
      const account = register ? await auth.register(String(details.get('name')), email, password, confirmPassword, next) : await auth.signIn(email, password)
      if (account) navigate(destination(next, account.role), { replace: true })
      else setConfirmEmail(email)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return <div className="container account-wrap">
    <section className="panel account-panel"><p className="eyebrow">{admin ? 'Marketplace staff' : hosting ? 'For bike owners' : 'RIDEON marketplace'}</p><h1>{title}</h1>
      <p>{admin ? 'Sign in with a RIDEON staff account.' : hosting ? 'Set up your storefront, list bikes, and manage requests. You can rent a bike with the same account.' : 'Book bikes or open a host storefront with the same account.'}</p>
      {!register && params.get('reset') === 'complete' && <p className="account-feedback form-success" role="status">Password updated. Sign in with your new password.</p>}
      {authStatus === 'confirmed' && <p className="account-feedback form-success" role="status">Email confirmed. You can now sign in.</p>}
      {authStatus === 'email-link' && <p className="account-feedback field-error" role="alert">This confirmation link is invalid or has expired. Try signing in if you already confirmed your email.</p>}
      {authStatus === 'google-cancelled' && <p className="account-feedback" role="status">Google sign-in was cancelled. You can try again or use email.</p>}
      {authStatus === 'google-failed' && <p className="account-feedback field-error" role="alert">Google sign-in couldn’t finish. Try again in this browser or use email.</p>}
      {register && confirmEmail ? <div className="account-feedback form-success" role="status">
        <p>Check <strong>{confirmEmail}</strong> for your confirmation link. After confirming, you can sign in with your password.</p>
      </div> : <>
        <div className="account-provider">
          <button className="button button-outline w-full" type="button" onClick={continueWithGoogle} disabled={busy !== null}>
            {busy === 'google' ? 'Opening Google…' : register ? 'Sign up with Google' : 'Sign in with Google'}
          </button>
          {googleError && <p className="field-error" role="alert">{googleError}</p>}
          <p className="account-divider">or use email</p>
        </div>
        <form className="contact-form" onSubmit={submit} onChange={() => setError('')}>
          {register && <label className="field"><span>Full name</span><input name="name" required maxLength={100} autoComplete="name" /></label>}
          <label className="field"><span>Email address</span><input name="email" type="email" required maxLength={254} autoComplete="username" /></label>
          {register ? <NewPasswordFields /> : <>
            <label className="field"><span>Password</span><input name="password" type="password" required maxLength={128} autoComplete="current-password" /></label>
            <Link className="forgot-password-link" to={'/forgot-password' + nextQuery}>Forgot password?</Link>
          </>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button primary w-full" type="submit" disabled={busy !== null}>{busy === 'email' ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
        </form>
      </>}
      {admin && <p className="account-switch">Want to list your own bikes? <Link to="/host">Become a host</Link></p>}
      {!admin && <p className="account-switch">{register ? 'Already have an account? ' : 'New to RIDEON? '}<Link to={(register ? '/sign-in' : '/register') + nextQuery}>{register ? 'Sign in' : 'Create an account'}</Link></p>}
    </section>
  </div>
}

export function PortalGuard({ role, children }: { role: Account['role']; children: ReactNode }) {
  const { account, error, retry } = useAuth()
  const { pathname, search } = useLocation()
  if (account === undefined) return <div className="container route-empty"><AsyncState error={error} onRetry={retry} label="Checking your session…" /></div>
  if (!account) return <Navigate to={`/sign-in?next=${encodeURIComponent(pathname + search)}`} replace />
  if (account.role !== role) return <div className="container route-empty"><EmptyState title={role === 'admin' ? 'Admin access required' : 'Rider account required'} description={role === 'admin' ? 'Sign out and use an administrator account to manage RIDEON.' : 'Sign out and use a rider account to request a booking.'} action={<Link className="button primary" to={account.role === 'admin' ? '/admin' : '/my-bookings'}>{account.role === 'admin' ? 'Admin portal' : 'My Bookings'}</Link>} /></div>
  return children
}
