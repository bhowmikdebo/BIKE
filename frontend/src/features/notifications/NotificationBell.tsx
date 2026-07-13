import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Bell, CalendarClock, CalendarPlus, CheckCircle2, Star, XCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import type { BookingNotification, NotificationInbox } from '../../../../shared/types.ts'
import { useApi } from '../../hooks/api'
import { api, errorMessage } from '../../utils/api'
import { bookingAnchor } from '../reservations/ReservationCard'
import { AsyncState, Dialog } from '../../components/ui'

const eventDetails = {
  requested: { label: 'New booking request', icon: CalendarPlus },
  confirmed: { label: 'Booking confirmed', icon: CheckCircle2 },
  cancelled: { label: 'Booking cancelled', icon: XCircle },
  completed: { label: 'Rental complete · Leave a review', icon: Star },
  pickup_reminder: { label: 'Bike pickup reminder', icon: CalendarClock },
  return_reminder: { label: 'Bike return reminder', icon: CalendarClock },
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })

function bookingLink(notification: BookingNotification) {
  const portal = notification.scope === 'host' ? '/host?tab=requests' : notification.scope === 'admin' ? '/admin?tab=bookings' : '/my-bookings'
  return portal + '#' + bookingAnchor(notification.bookingId)
}

export function NotificationBell() {
  const { data, error, refresh, reload } = useApi<NotificationInbox>('/api/notifications')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [readError, setReadError] = useState('')
  const navigate = useNavigate()
  const unread = data?.unread ?? 0

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refresh()
    }
    const timer = window.setInterval(refreshWhenVisible, 45_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh])

  async function markAllRead() {
    if (saving) return
    setSaving(true)
    setReadError('')
    try {
      await api('/api/notifications/read', { method: 'PATCH' })
      refresh()
    } catch (error) {
      setReadError(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function openBooking(event: MouseEvent<HTMLAnchorElement>, notification: BookingNotification) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (!notification.read) await api('/api/notifications/' + notification.id + '/read', { method: 'PATCH' })
    } catch { /* A read-status failure still lets the user open the booking. */ }
    finally {
      setSaving(false)
      setOpen(false)
      refresh()
      navigate(bookingLink(notification))
    }
  }

  return <>
    <button className="icon-button notification-bell" type="button" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      title="Notifications" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setReadError(''); setOpen(true); refresh() }}>
      <Bell size={19} aria-hidden="true" />
      {unread > 0 && <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <Dialog title="Notifications" className="notification-dialog" onClose={() => setOpen(false)}>
      {unread > 0 && <div className="notification-toolbar"><span>{unread} unread</span>
        <button className="text-button" type="button" onClick={markAllRead} disabled={saving}>Mark all as read</button>
      </div>}
      {readError && <p className="field-error" role="alert">{readError}</p>}
      {!data ? <AsyncState label="Loading notifications…" error={error} onRetry={reload} /> : data.items.length === 0 ?
        <p className="notification-empty">Booking updates and pickup or return reminders will appear here.</p> :
        <ul className="notification-list" aria-busy={saving}>{data.items.map(item => {
          const { label, icon: Icon } = eventDetails[item.kind]
          return <li key={item.id}>
            <Link className="notification-item" data-unread={!item.read} to={bookingLink(item)} onClick={event => void openBooking(event, item)}>
              <span className="notification-icon"><Icon size={18} aria-hidden="true" /></span>
              <span className="notification-copy"><strong>{label}</strong><span>{item.bikeName} · {item.bookingId}</span>
                <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
              </span>
              {!item.read && <span className="notification-dot"><span className="sr-only">Unread</span></span>}
            </Link>
          </li>
        })}</ul>}
    </Dialog>}
  </>
}
