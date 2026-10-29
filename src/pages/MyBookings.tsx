import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { ReservationCard } from '../components/ReservationCard'
import { AsyncState, Dialog, EmptyState } from '../components/ui'
import { useApi } from '../hooks/api'
import { useAuth } from '../hooks/auth'
import type { BookingRecord } from '../types'
import { api, errorMessage } from '../utils/api'
import { today } from '../utils/rental'

export function MyBookings() {
  const { account } = useAuth()
  const { state } = useLocation()
  const bookings = useApi<BookingRecord[]>('/api/bookings')
  const [cancel, setCancel] = useState<BookingRecord>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const requested = state && typeof state.requested === 'string' ? state.requested : ''

  async function cancelBooking() {
    if (!cancel || busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/bookings/${cancel.id}/status`, { method: 'PATCH', body: { status: 'cancelled' } })
      setMessage(`${cancel.id} was cancelled.`)
      setCancel(undefined)
      bookings.reload()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">Rider portal</p><h1>My bookings</h1><p>Manage your reservations and check your pickup status{account ? `, ${account.name}` : ''}.</p></div></section>
    <section className="container portal-content" aria-label="Your reservations">
      {(message || requested) && <div className="form-success" role="status"><CheckCircle2 size={20} /><p>{message || `Booking request ${requested} received.`}</p></div>}
      {!bookings.data ? <AsyncState label="Loading your bookings…" error={bookings.error} onRetry={bookings.reload} /> :
        !bookings.data.length ? <EmptyState title="Your bookings will appear here" description="Find a bike and select your dates to request a rental." action={<Link className="button primary" to="/bikes">Explore Bikes</Link>} /> :
          <div className="reservation-grid">{bookings.data.map(booking => <ReservationCard key={booking.id} booking={booking}>
            {['pending', 'confirmed'].includes(booking.status) && booking.pickup >= today() && <button className="button button-outline" type="button" onClick={() => { setError(''); setCancel(booking) }}>Cancel booking</button>}
          </ReservationCard>)}</div>}
    </section>
    {cancel && <Dialog title="Cancel this booking?" onClose={() => { if (!busy) setCancel(undefined) }}><div className="dialog-body">
      <p>{cancel.bikeName} · {cancel.id}. Cancelling releases the bike for those dates.</p>
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="portal-actions"><button className="button button-outline" disabled={busy} onClick={() => setCancel(undefined)}>Keep booking</button><button className="button primary" disabled={busy} onClick={cancelBooking}>{busy ? 'Cancelling…' : 'Cancel booking'}</button></div>
    </div></Dialog>}
  </>
}
