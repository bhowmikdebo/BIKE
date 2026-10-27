import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, ChevronRight, Info } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BookingSummary } from '../components/Booking'
import { EmptyState } from '../components/ui'
import { bikeName, bikes } from '../data/fleet'
import { dateError, isAvailable, readFilters, rentalSearch, searchString } from '../utils/rental'

function CustomerForm() {
  const [message, setMessage] = useState('')
  const [complete, setComplete] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '').trim()
    const phone = String(data.get('phone') ?? '').replace(/\D/g, '')
    if (name.length < 2 || phone.length < 10 || phone.length > 15) {
      setMessage('Enter your full name and a phone number with 10–15 digits.')
      return
    }
    event.currentTarget.reset()
    setMessage('')
    setComplete(true)
  }

  return <div className="panel customer-panel">
    <h2>Rider details</h2>
    <p className="section-description">Use sample details to try the form.</p>
    {complete ? <div role="status" className="form-success"><CheckCircle2 size={27} /><div><strong>Demo preview complete</strong><p>Your itinerary is ready to review on this page.</p><button className="text-button" onClick={() => setComplete(false)}>Try the form again</button></div></div> :
      <form className="contact-form" onSubmit={submit} onChange={() => setMessage('')}>
        <label className="field"><span>Full name</span><input required name="name" autoComplete="off" placeholder="Sam Rider" maxLength={100} /></label>
        <div className="form-pair">
          <label className="field"><span>Email address</span><input required type="email" name="email" autoComplete="off" placeholder="rider@example.com" /></label>
          <label className="field"><span>Phone number</span><input required type="tel" name="phone" autoComplete="off" placeholder="98765 43210" maxLength={25} /></label>
        </div>
        <label className="agreement"><input type="checkbox" required name="agreement" /> <span>I understand this is a demo preview and does not reserve a vehicle.</span></label>
        {message && <p role="alert" className="field-error">{message}</p>}
        <button className="button primary" type="submit">Complete Demo Preview</button>
      </form>}
  </div>
}

export function Booking() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const bike = bikes.find(item => item.id === id)
  const rental = rentalSearch(readFilters(params))
  const query = searchString(rental)
  const valid = bike && rental.city && !dateError(rental.pickup, rental.returnDate) && isAvailable(bike, rental)

  return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">Demo only</p><h1>Booking preview</h1><p>Review your bike, dates and estimated rental cost.</p></div></section>
    <div className="container booking-shell">
      {!valid || !bike ? <EmptyState title="Choose a bike and rental dates" description="A valid pickup city and available dates are needed to open a booking preview." action={<Link className="button primary" to={bike ? `/bikes/${bike.id}${query}#reserve` : '/bikes'}>{bike ? 'Edit rental details' : 'Explore Bikes'}</Link>} /> :
        <>
          <nav aria-label="Breadcrumbs" className="breadcrumbs"><Link to="/bikes">Explore Bikes</Link><ChevronRight size={15} /><Link to={`/bikes/${bike.id}${query}#reserve`}>{bikeName(bike)}</Link><ChevronRight size={15} /><span>Booking preview</span></nav>
          <div className="demo-banner"><Info size={21} /><p><strong>Demo Only.</strong> This preview does not create a reservation or take payment.</p></div>
          <div className="booking-layout grid"><CustomerForm key={bike.id + query} /><BookingSummary bike={bike} rental={rental} /></div>
        </>}
    </div>
  </>
}
