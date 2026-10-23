import { CalendarDays, MapPin } from 'lucide-react'
import { bikeImage, bikeName } from '../data/fleet'
import type { Bike, RentalSearch } from '../types'
import { displayDate, money, rentalDays } from '../utils/rental'
import { ImageAsset } from './ui'

export function PriceBreakdown({ bike, days }: { bike: Bike; days: number }) {
  return <dl className="price-breakdown">
    <div><dt>Daily rental rate</dt><dd>{money(bike.price)}</dd></div>
    <div><dt>Rental duration</dt><dd>{days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : '—'}</dd></div>
    <div className="price-total"><dt>Estimated total</dt><dd>{days > 0 ? money(bike.price * days) : '—'}</dd></div>
  </dl>
}

export function BookingSummary({ bike, rental }: { bike: Bike; rental: RentalSearch }) {
  return <aside className="booking-summary panel" aria-labelledby="booking-summary-title">
    <h2 id="booking-summary-title">Booking summary</h2>
    <div className="summary-bike"><ImageAsset src={bikeImage(bike.id)} alt="" width={508} height={337} /><div><p className="bike-brand">{bike.brand}</p><h3>{bike.model}</h3><p>{bike.category}</p></div></div>
    <dl className="summary-itinerary">
      <div><dt><MapPin size={17} /> Pickup location</dt><dd>{rental.city}</dd></div>
      <div><dt><CalendarDays size={17} /> Pickup</dt><dd>{displayDate(rental.pickup)}</dd></div>
      <div><dt><CalendarDays size={17} /> Return</dt><dd>{displayDate(rental.returnDate)}</dd></div>
    </dl>
    <PriceBreakdown bike={bike} days={rentalDays(rental.pickup, rental.returnDate)} />
    <p className="small-note">Illustrative estimate for {bikeName(bike)}.</p>
  </aside>
}
