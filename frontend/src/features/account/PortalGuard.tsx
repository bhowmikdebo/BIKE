import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import type { Account } from '../../../../shared/types.ts'
import { AsyncState, EmptyState } from '../../components/ui'
import { useAuth } from './auth'

export function PortalGuard({ role, children }: { role: Account['role']; children: ReactNode }) {
  const { account, error, retry } = useAuth()
  const { pathname, search } = useLocation()
  if (account === undefined) return <div className="container route-empty"><AsyncState error={error} onRetry={retry} label="Checking your session…" /></div>
  if (!account) return <Navigate to={`/sign-in?next=${encodeURIComponent(pathname + search)}`} replace />
  if (account.role !== role) return <div className="container route-empty"><EmptyState title={role === 'admin' ? 'Admin access required' : 'Rider account required'} description={role === 'admin' ? 'Sign out and use an administrator account to manage RIDEON.' : 'Sign out and use a rider account to request a booking.'} action={<Link className="button primary" to={account.role === 'admin' ? '/admin' : '/my-bookings'}>{account.role === 'admin' ? 'Admin portal' : 'My Bookings'}</Link>} /></div>
  return children
}
