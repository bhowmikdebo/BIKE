import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, Check, ChevronRight, Fuel, Gauge, Heart, MapPin, Settings2, Users } from 'lucide-react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { BikeGrid } from '../components/BikeCard'
import { PriceBreakdown } from '../components/Booking'
import { HostLink } from '../components/HostLink'
import { useAuth } from '../hooks/auth'
import { DateSelector } from '../components/Search'
import { AsyncState, EmptyState, ImageAsset, SectionHeading } from '../components/ui'
import { bikeImage, bikeName } from '../../../shared/fleet.ts'
import { useApi } from '../hooks/api'
import { useFavorites } from '../hooks/favorites'
import type { Bike, RentalSearch } from '../../../shared/types.ts'
import { api, errorMessage } from '../utils/api'
import { addDays, dateError, money, readFilters, rentalDays, rentalSearch, searchString, today } from '../../../shared/rental.ts'

const views = [{ id: 'overview', name: 'Full bike' }, { id: 'tank', name: 'Bodywork detail' }, { id: 'wheel', name: 'Front wheel detail' }]

function Gallery({ bike }: { bike: Bike }) {
  const [active, setActive] = useState('overview')
  return <div className="gallery">
    <div className={`gallery-main gallery-${active}`}><ImageAsset width={508} height={337} src={bikeImage(bike)} alt={`${bikeName(bike)} — ${views.find(view => view.id === active)?.name}`} /></div>
    <div className="gallery-bottom"><div className="gallery-thumbs" aria-label="Choose image crop">{views.map(view => <button className={`thumb gallery-${view.id}`} type="button" key={view.id} aria-label={view.name} aria-pressed={view.id === active} onClick={() => setActive(view.id)}><ImageAsset src={bikeImage(bike)} alt="" width={508} height={337} /></button>)}</div>{bikeImage(bike).startsWith('/images/') && <span className="small-note">Illustrative model imagery</span>}</div>
  </div>
}

function RentalPanel({ bike, initial }: { bike: Bike; initial: RentalSearch }) {
  const navigate = useNavigate()
  const { account } = useAuth()
  const ownListing = Boolean(bike.host && account?.host?.slug === bike.host.slug)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash !== '#reserve') return
    const frame = requestAnimationFrame(() => document.getElementById('reserve')?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [hash])
  const { ids, toggle } = useFavorites()
  const saved = ids.includes(bike.id)
  const pickup = initial.pickup || today()
  const [rental, setRental] = useState<RentalSearch>({
    city: bike.cities.includes(initial.city) ? initial.city : '',
    pickup,
    returnDate: initial.returnDate || addDays(pickup, 1),
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const validDates = !dateError(rental.pickup, rental.returnDate)
  const days = validDates ? rentalDays(rental.pickup, rental.returnDate) : 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = dateError(rental.pickup, rental.returnDate)
    if (validation) return setError(validation)
    const query = searchString(rentalSearch(rental))
    setError('')
    setBusy(true)
    try {
      await api(`/api/bikes/${bike.id}/availability${query}`)
      navigate(`/booking/${bike.id}${query}`)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <aside className="rental-panel panel" id="reserve" aria-labelledby="reserve-title">
    <div className="rental-panel-heading"><div><p className="eyebrow" id="reserve-title">Plan your rental</p><p><strong>{money(bike.price)}</strong> / day</p></div><button className={`icon-button detail-favorite ${saved ? 'favorite-active' : ''}`} type="button" aria-pressed={saved} aria-label={`Favorite ${bikeName(bike)}`} onClick={() => toggle(bike.id)}><Heart size={21} fill={saved ? 'currentColor' : 'none'} /></button></div>
    {ownListing ? <div className="dialog-body"><p>This bike is listed on your storefront.</p><Link className="button button-outline" to="/host">Manage your listing</Link></div> : <form onSubmit={submit}>
      <label className="field"><span>Pickup location</span><span className="field-control"><MapPin size={17} /><select required value={rental.city} onChange={event => { setRental({ ...rental, city: event.target.value }); setError('') }}><option value="">Select city</option>{bike.cities.map(city => <option key={city}>{city}</option>)}</select></span></label>
      <div className="form-pair"><DateSelector value={rental} required onChange={value => { setRental(value); setError('') }} /></div>
      <PriceBreakdown bike={bike} days={days} />
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="button primary w-full" type="submit" disabled={busy}>{busy ? 'Checking availability…' : 'Continue to Booking'}</button>
      <p className="small-note">Request a booking without paying upfront</p>
    </form>}
  </aside>
}

function BikeDetail({ bike, initial, bikes }: { bike: Bike; initial: RentalSearch; bikes: Bike[] }) {
  const specs = [
    { icon: Gauge, label: 'Engine', value: `${bike.engine} cc` },
    { icon: Settings2, label: 'Transmission', value: bike.transmission },
    { icon: Fuel, label: 'Estimated mileage', value: `${bike.mileage} km/l` },
    { icon: Fuel, label: 'Fuel type', value: bike.fuel },
    { icon: Users, label: 'Seating', value: `${bike.seats} people` },
  ]
  const otherBikes = bikes.filter(item => item.id !== bike.id).sort((a, b) => Number(b.category === bike.category) - Number(a.category === bike.category)).slice(0, 3)
  return <div className="container details-shell">
    <nav aria-label="Breadcrumbs" className="breadcrumbs"><Link to="/">Home</Link><ChevronRight size={15} /><Link to={`/bikes${searchString(rentalSearch(initial))}`}>Explore Bikes</Link><ChevronRight size={15} /><span>{bike.model}</span></nav>
    <div className="details-heading"><p className="eyebrow">{bike.category}</p><h1>{bikeName(bike)}</h1><HostLink host={bike.host} /></div>
    <div className="details-layout grid">
      <Gallery bike={bike} />
      <RentalPanel bike={bike} initial={initial} />
      <div className="details-content">
        <section><h2>About this bike</h2><p>{bike.description}</p></section>
        <section><h2>Specifications</h2><dl className="spec-grid grid">{specs.map(({ icon: Icon, label, value }) => <div key={label}><Icon size={20} /><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="small-note">Specifications and mileage are illustrative. Model variants may differ.</p></section>
        <section><h2>Features</h2><ul className="check-list">{bike.features.map(feature => <li key={feature}><Check size={17} />{feature}</li>)}</ul></section>
        <section className="rental-note"><CalendarDays size={23} /><div><h2>Rental information</h2><p>Rentals are priced in full days. Review your dates and total before you submit. Check My Bookings for your request status and pickup details.</p></div></section>
      </div>
    </div>
    <section className="related-bikes"><SectionHeading title="More bikes to explore" /><BikeGrid bikes={otherBikes} query={searchString(rentalSearch(initial))} /></section>
  </div>
}

export function Details() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { search } = useLocation()
  const fleet = useApi<Bike[]>('/api/bikes')
  if (!fleet.data) return <div className="container route-empty"><AsyncState error={fleet.error} onRetry={fleet.reload} label="Loading bike details…" /></div>
  const bike = fleet.data.find(item => item.id === id)
  if (!bike) return <div className="container route-empty"><h1>Bike unavailable</h1><EmptyState title="Explore the current fleet" description="This bike is no longer listed in the fleet." action={<Link className="button primary" to="/bikes">Explore Bikes</Link>} /></div>
  return <BikeDetail key={bike.id + search} bike={bike} bikes={fleet.data} initial={readFilters(params)} />
}
