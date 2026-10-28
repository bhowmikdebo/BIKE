import type { ReactNode } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import type { BookingRecord, BookingStatus } from '../types'
import { displayDate, money } from '../utils/rental'

export const statusLabels: Record<BookingStatus, string> = {
  pending: 'Pending review', confirmed: 'Confirmed', in_progress: 'Picked up', completed: 'Completed', cancelled: 'Cancelled',
}

export function ReservationCard({ booking, admin = false, children }: { booking: BookingRecord; admin?: boolean; children?: ReactNode }) {
  return <article className="panel reservation-card">
    <div className="reservation-heading"><div><p className="bike-brand">{booking.id}</p><h3>{booking.bikeName}</h3></div><span className={`status-pill status-${booking.status}`}>{statusLabels[booking.status]}</span></div>
    <dl className="reservation-details">
      <div><dt><MapPin size={16} />Pickup city</dt><dd>{booking.city}</dd></div>
      <div><dt><CalendarDays size={16} />Rental dates</dt><dd>{displayDate(booking.pickup)} – {displayDate(booking.returnDate)}</dd></div>
      <div><dt>Rental cost</dt><dd>{money(booking.total)} <span className="small-note"> · {booking.days} {booking.days === 1 ? 'day' : 'days'} × {money(booking.dailyRate)}</span></dd></div>
      {admin && <div><dt>Rider</dt><dd>{booking.riderName}<small>{booking.riderEmail} · {booking.phone}</small></dd></div>}
    </dl>
    {children}
  </article>
}
