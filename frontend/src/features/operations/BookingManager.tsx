import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import type { BookingRecord, BookingStatus, OperatorScope } from '../../../../shared/types.ts'
import { AsyncState, Dialog } from '../../components/ui'
import { useApi } from '../../hooks/api'
import { api, errorMessage } from '../../utils/api'
import { ReservationCard, statusLabels } from '../reservations/ReservationCard'

const bookingActions: Partial<Record<BookingStatus, { status: BookingStatus; label: string }[]>> = {
  pending: [{ status: 'confirmed', label: 'Confirm booking' }, { status: 'cancelled', label: 'Cancel booking' }],
  confirmed: [{ status: 'in_progress', label: 'Mark picked up' }, { status: 'cancelled', label: 'Cancel booking' }],
  in_progress: [{ status: 'completed', label: 'Mark returned' }],
}

export function BookingManager({ scope }: { scope: OperatorScope }) {
  const endpoint = `/api/${scope}/bookings`
  const bookings = useApi<BookingRecord[]>(endpoint)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<{ booking: BookingRecord; status: BookingStatus; label: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { hash, key } = useLocation()
  useEffect(() => { if (hash.startsWith('#booking-')) setFilter('') }, [hash, key])
  const filtered = bookings.data?.filter(booking => !filter || booking.status === filter)

  async function update() {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    try {
      await api(`${endpoint}/${selected.booking.id}/status`, { method: 'PATCH', body: { status: selected.status } })
      setMessage(`${selected.booking.id} · ${statusLabels[selected.status]}`)
      setSelected(undefined)
      bookings.reload()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <section aria-labelledby="manage-bookings">
    <div className="portal-toolbar"><div><h2 id="manage-bookings">{scope === 'host' ? 'Incoming reservations' : 'Reservations'}</h2><p>Review requests and update pickup or return status.</p></div>
      <label className="field"><span className="sr-only">Booking status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {message && <p className="form-success" role="status">{message}</p>}
    {!filtered ? <AsyncState error={bookings.error} onRetry={bookings.reload} label="Loading reservations…" /> :
      !filtered.length ? <p className="async-state">{filter ? 'No reservations have this status.' : 'New booking requests will appear here.'}</p> :
        <div className="reservation-grid">{filtered.map(booking => <ReservationCard operator key={booking.id} booking={booking}>
          <div className="portal-actions">{bookingActions[booking.status]?.map(action => <button className={`button ${action.status === 'cancelled' ? 'button-outline' : 'primary'}`} type="button" key={action.status} onClick={() => { setSelected({ booking, ...action }); setError('') }}>{action.label}</button>)}</div>
        </ReservationCard>)}</div>}
    {selected && <Dialog title={selected.label} onClose={() => { if (!busy) setSelected(undefined) }}><div className="dialog-body">
      <p>{selected.booking.bikeName} · {selected.booking.id} · {selected.booking.riderName}</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="portal-actions"><button className="button button-outline" type="button" disabled={busy} onClick={() => setSelected(undefined)}>Go back</button><button className="button primary" type="button" disabled={busy} onClick={update}>{busy ? 'Saving…' : selected.label}</button></div>
    </div></Dialog>}
  </section>
}
