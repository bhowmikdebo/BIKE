import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AsyncState, EmptyState } from '../components/ui'
import { useAuth } from '../hooks/auth'
import type { Account } from '../../../shared/types.ts'
import { errorMessage } from '../utils/api'

function destination(next: string | null, role: Account['role']) {
  if (next?.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && !next.startsWith('/sign-in') && !next.startsWith('/register')) return next
  return role === 'admin' ? '/admin' : '/my-bookings'
}

export function AccountPage({ register = false }: { register?: boolean }) {
  const auth = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)
  const next = params.get('next')
  const admin = next === '/admin'
  const hosting = next === '/host' || next?.startsWith('/host?')
  const title = register ? hosting ? 'Create a host account' : 'Create your RIDEON account' : admin ? 'Staff sign in' : hosting ? 'Sign in to host' : 'Sign in to RIDEON'
  if (auth.account) return <Navigate to={destination(next, auth.account.role)} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const details = new FormData(event.currentTarget)
    const email = String(details.get('email'))
    const password = String(details.get('password'))
    setBusy(true)
    setError('')
    try {
      const account = register ? await auth.register(String(details.get('name')), email, password) : await auth.signIn(email, password)
      if (account) navigate(destination(next, account.role), { replace: true })
      else setConfirmEmail(true)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <div className="container account-wrap">
    <section className="panel account-panel"><p className="eyebrow">{admin ? 'Marketplace staff' : hosting ? 'For bike owners' : 'RIDEON marketplace'}</p><h1>{title}</h1>
      <p>{admin ? 'Sign in with a RIDEON staff account.' : hosting ? 'Set up your storefront, list bikes, and manage requests. You can rent a bike with the same account.' : 'Book bikes or open a host storefront with the same account.'}</p>
      {register && confirmEmail ? <div className="form-success" role="status">
        <p>Open the confirmation link in your email, then return here and sign in.</p>
      </div> : <form className="contact-form" onSubmit={submit} key={String(register)}>
        {register && <label className="field"><span>Full name</span><input name="name" required maxLength={100} autoComplete="name" /></label>}
        <label className="field"><span>Email address</span><input name="email" type="email" required maxLength={254} autoComplete="username" /></label>
        <label className="field"><span>Password</span><input name="password" type="password" required minLength={register ? 12 : 1} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} />{register && <small>Use at least 12 characters.</small>}</label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="button primary w-full" type="submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>}
      {admin && <p className="account-switch">Want to list your own bikes? <Link to="/host">Become a host</Link></p>}
      {!admin && <p className="account-switch">{register ? 'Already have an account? ' : 'New to RIDEON? '}<Link to={`${register ? '/sign-in' : '/register'}${params.size ? '?' + params.toString() : ''}`}>{register ? 'Sign in' : 'Create an account'}</Link></p>}
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
