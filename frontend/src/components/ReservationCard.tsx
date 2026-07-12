import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { useLocation } from 'react-router'
import type { BookingRecord, BookingStatus } from '../../../shared/types.ts'
import { HostLink } from './HostLink'
import { displayDate, money } from '../../../shared/rental.ts'

export const statusLabels: Record<BookingStatus, string> = {
  pending: 'Pending review', confirmed: 'Confirmed', in_progress: 'Picked up', completed: 'Completed', cancelled: 'Cancelled',
}

export const bookingAnchor = (bookingId: string) => 'booking-' + bookingId

export function ReservationCard({ booking, operator = false, children }: { booking: BookingRecord; operator?: boolean; children?: ReactNode }) {
  const { hash, key } = useLocation()
  const card = useRef<HTMLElement>(null)
  const anchor = bookingAnchor(booking.id)
  const targeted = hash === '#' + anchor
  useEffect(() => {
    if (targeted) {
      card.current?.scrollIntoView({ block: 'start' })
      card.current?.focus({ preventScroll: true })
    }
  }, [targeted, key])
  const contact = [booking.riderEmail, booking.phone].filter(Boolean).join(' · ')
  return <article className="panel reservation-card" id={anchor} ref={card} tabIndex={-1} data-targeted={targeted}>
    <div className="reservation-heading"><div><p className="bike-brand">{booking.id}</p><h3>{booking.bikeName}</h3></div><span className={`status-pill status-${booking.status}`}>{statusLabels[booking.status]}</span></div>
    <dl className="reservation-details">
      <div><dt><MapPin size={16} />Pickup city</dt><dd>{booking.city}</dd></div>
      <div><dt><CalendarDays size={16} />Rental dates</dt><dd>{displayDate(booking.pickup)} – {displayDate(booking.returnDate)}</dd></div>
      <div><dt>Rental cost</dt><dd>{money(booking.total)} <span className="small-note"> · {booking.days} {booking.days === 1 ? 'day' : 'days'} × {money(booking.dailyRate)}</span></dd></div>
      <div><dt>Rental provider</dt><dd><HostLink host={booking.host} /></dd></div>
      {operator && <div><dt>Rider</dt><dd>{booking.riderName}{contact && <small>{contact}</small>}</dd></div>}
      {!!booking.pickupInstructions && <div><dt>Pickup instructions</dt><dd className="pickup-instructions">{booking.pickupInstructions}</dd></div>}
    </dl>
    {children}
  </article>
}
