import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { BookingSummary } from '../components/Booking'
import { AsyncState, EmptyState } from '../components/ui'
import { bikeName } from '../data/fleet'
import { useApi } from '../hooks/api'
import { useAuth } from '../hooks/auth'
import type { Account, Bike, BookingQuote, BookingRecord, RentalSearch } from '../types'
import { api, ApiError, errorMessage } from '../utils/api'
import { dateError, readFilters, rentalSearch, searchString } from '../utils/rental'

function RiderForm({ account, bike, rental, onRefresh }: { account: Account; bike: Bike; rental: RentalSearch; onRefresh: () => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [staleQuote, setStaleQuote] = useState(false)
  const [requestKey] = useState(() => crypto.randomUUID())
  const navigate = useNavigate()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    setStaleQuote(false)
    try {
      const booking = await api<BookingRecord>('/api/bookings', { method: 'POST', body: {
        ...rental, bikeId: bike.id, dailyRate: bike.price, requestKey,
        riderName: data.get('name'), phone: data.get('phone'), agreement: data.get('agreement') === 'on',
      } })
      navigate('/my-bookings', { replace: true, state: { requested: booking.id } })
    } catch (error) {
      setError(errorMessage(error))
      setStaleQuote(error instanceof ApiError && [404, 409].includes(error.status))
    } finally {
      setBusy(false)
    }
  }

  return <div className="panel customer-panel">
    <h2>Rider details</h2>
    <p className="section-description">Your booking will be linked to {account.email}.</p>
    <form className="contact-form" onSubmit={submit}>
      <label className="field"><span>Rider name</span><input required name="name" autoComplete="name" maxLength={100} defaultValue={account.name} /></label>
      <label className="field"><span>Phone number</span><input required type="tel" name="phone" autoComplete="tel" placeholder="98765 43210" maxLength={25} /></label>
      <label className="agreement"><input type="checkbox" required name="agreement" /> <span>I’ve checked the pickup city and dates. I’ll wait for confirmation before arriving.</span></label>
      {error && <p role="alert" className="field-error">{error}</p>}
      {staleQuote ? <button className="button button-outline" type="button" onClick={onRefresh}>Check latest availability</button> :
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Request booking'}</button>}
    </form>
  </div>
}

function BookingPageHeading() {
  return <section className="page-banner"><div className="container"><p className="eyebrow">RIDEON reservations</p><h1>Review your booking</h1><p>Check your bike, pickup city, dates, and rental cost.</p></div></section>
}

export function Booking() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const auth = useAuth()
  const rental = rentalSearch(readFilters(params))
  const query = searchString(rental)
  const valid = Boolean(id && rental.city && !dateError(rental.pickup, rental.returnDate))
  const fleet = useApi<Bike[]>(valid ? '/api/bikes' : null)
  const bike = fleet.data?.find(item => item.id === id)
  const quote = useApi<BookingQuote>(bike ? `/api/bikes/${bike.id}/availability${query}` : null)
  const signIn = `/sign-in?next=${encodeURIComponent(pathname + search)}`

  return <>
    <BookingPageHeading />
    <div className="container booking-shell">
      {!valid || (fleet.data && !bike) ? <EmptyState title="Choose an available bike and dates" description="Select a pickup city and a date range to review your reservation." action={<Link className="button primary" to="/bikes">Explore Bikes</Link>} /> :
        !bike ? <AsyncState error={fleet.error} onRetry={fleet.reload} label="Loading the selected bike…" /> :
        <>
          <nav aria-label="Breadcrumbs" className="breadcrumbs"><Link to="/bikes">Explore Bikes</Link><ChevronRight size={15} /><Link to={`/bikes/${bike.id}${query}#reserve`}>{bikeName(bike)}</Link><ChevronRight size={15} /><span>Review booking</span></nav>
          {quote.data ? <>
            <div className="demo-banner"><Info size={21} /><p><strong>Booking requests are reviewed by RIDEON.</strong> Check My Bookings for confirmation.</p></div>
            <div className="booking-layout grid">
              {auth.account?.role === 'customer' ?
                <RiderForm key={bike.id + query + quote.data.dailyRate} account={auth.account} bike={{ ...bike, price: quote.data.dailyRate }} rental={rental} onRefresh={quote.reload} /> :
                auth.account === undefined ? <AsyncState error={auth.error} onRetry={auth.retry} label="Checking your session…" /> :
                <div className="panel customer-panel"><h2>Rider account required</h2><p className="section-description">{auth.account ? 'Sign out of the administrator account and sign in as a rider to submit a booking.' : 'Sign in or create a rider account to request this bike.'}</p>{!auth.account && <Link className="button primary" to={signIn}>Sign in to book</Link>}</div>}
              <BookingSummary bike={{ ...bike, price: quote.data.dailyRate }} rental={rental} />
            </div>
          </> : <div className="quote-state">
            <AsyncState label="Checking dates and rental rate…" error={quote.error} onRetry={quote.reload} />
            {quote.error && <Link className="button button-outline" to={`/bikes/${bike.id}${query}#reserve`}>Change dates or pickup city</Link>}
          </div>}
        </>}
    </div>
  </>
}
