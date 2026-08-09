import { Bike, CalendarDays } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { BookingManager, FleetManager } from '../operations/Operations'

export function Admin() {
  const [params, setParams] = useSearchParams()
  const bookingTab = params.get('tab') === 'bookings'
  return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">RIDEON administration</p><h1>Admin portal</h1><p>Manage the marketplace catalog and review reservations across hosts.</p></div></section>
    <div className="container portal-content">
      <nav aria-label="Admin sections" className="portal-tabs"><button type="button" aria-pressed={!bookingTab} onClick={() => setParams({})}><Bike size={19} />Fleet</button><button type="button" aria-pressed={bookingTab} onClick={() => setParams({ tab: 'bookings' })}><CalendarDays size={18} />Bookings</button></nav>
      {bookingTab ? <BookingManager scope="admin" /> : <FleetManager scope="admin" />}
    </div>
  </>
}
