import { useState } from 'react'
import { CalendarDays, Plus, Search } from 'lucide-react'
import { ReservationCard, statusLabels } from '../../components/ReservationCard'
import { AsyncState, Dialog, ImageAsset } from '../../components/ui'
import { bikeImage, bikeName } from '../../../../shared/fleet.ts'
import { useApi } from '../../hooks/api'
import type { BookingRecord, BookingStatus, ManagedBike } from '../../../../shared/types.ts'
import { api, errorMessage } from '../../utils/api'
import { money } from '../../../../shared/rental.ts'
import { BikeEditor } from './BikeEditor'
import { AvailabilityDialog } from './AvailabilityDialog'

export type OperatorScope = 'admin' | 'host'

export function FleetManager({ scope }: { scope: OperatorScope }) {
  const endpoint = `/api/${scope}/bikes`
  const fleet = useApi<ManagedBike[]>(endpoint)
  const [calendar, setCalendar] = useState<ManagedBike>()
  const [editor, setEditor] = useState<ManagedBike | 'new'>()
  const [publication, setPublication] = useState<ManagedBike>()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const filtered = fleet.data?.filter(bike => bikeName(bike).toLowerCase().includes(query.toLowerCase().trim()))

  async function updatePublication() {
    if (!publication || busy) return
    setBusy(true)
    setError('')
    try {
      const bike = await api<ManagedBike>(`${endpoint}/${publication.id}/publication`, { method: 'PATCH', body: { active: !publication.active } })
      setMessage(`${bikeName(bike)} was ${bike.active ? 'published' : 'archived'}.`)
      setPublication(undefined)
      fleet.reload()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <section aria-labelledby="fleet-manager">
    <div className="portal-toolbar"><div><h2 id="fleet-manager">{scope === 'host' ? 'Your listings' : 'Fleet inventory'}</h2><p>{fleet.data ? `${fleet.data.filter(bike => bike.active).length} published of ${fleet.data.length} bikes` : 'Manage bike listings, rates, and pickup cities.'}</p></div>
      <button className="button primary" type="button" onClick={() => setEditor('new')}><Plus size={18} />Add bike</button>
    </div>
    {message && <p className="form-success" role="status">{message}</p>}
    <label className="catalog-search admin-search"><Search size={18} /><span className="sr-only">Search fleet by name</span><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Search fleet by name" /></label>
    {!filtered ? <AsyncState error={fleet.error} onRetry={fleet.reload} label="Loading the fleet…" /> :
      !filtered.length ? <p className="async-state">{query ? 'No bikes match your search.' : 'Add your first bike to get started.'}</p> :
        <div className="admin-fleet">{filtered.map(bike => <article className="panel inventory-row" key={bike.id}>
          <ImageAsset className="inventory-image" width={120} height={80} src={bike.hasUploadedImage ? `${endpoint}/${bike.id}/image` : bikeImage(bike)} alt="" loading="lazy" />
          <div className="inventory-name"><p className="bike-brand">{bike.brand}</p><h3>{bike.model}</h3><p>{bike.category} · {bike.cities.join(', ')}{scope === 'admin' && bike.host ? ` · ${bike.host.name}` : ''}</p></div>
          <div className="inventory-rate"><strong>{money(bike.price)}</strong><small> / day</small></div>
          <span className={`status-pill ${bike.active ? 'status-confirmed' : 'status-cancelled'}`}>{bike.active ? 'Published' : 'Archived'}</span>
          <div className="portal-actions"><button className="button button-outline" type="button" onClick={() => setEditor(bike)} aria-label={`Edit ${bikeName(bike)}`}>Edit</button>{scope === 'host' && <button className="button button-outline" type="button" onClick={() => setCalendar(bike)} aria-label={`Availability for ${bikeName(bike)}`}><CalendarDays size={16} />Availability</button>}<button className="button button-outline" type="button" onClick={() => { setPublication(bike); setError('') }} aria-label={`${bike.active ? 'Archive' : 'Publish'} ${bikeName(bike)}`}>{bike.active ? 'Archive' : 'Publish'}</button></div>
        </article>)}</div>}
    {editor && <BikeEditor scope={scope} bike={editor === 'new' ? undefined : editor} onClose={() => setEditor(undefined)} onSaved={bike => {
      setMessage(`${bikeName(bike)} was saved.`)
      setEditor(undefined)
      fleet.reload()
    }} />}
    {calendar && <AvailabilityDialog bike={calendar} onClose={() => setCalendar(undefined)} />}
    {publication && <Dialog title={publication.active ? 'Archive this bike?' : 'Publish this bike?'} onClose={() => { if (!busy) setPublication(undefined) }}>
      <div className="dialog-body"><p>{publication.active ? 'New customers will no longer see this bike in the catalog. Existing reservations stay in the booking list.' : 'The bike will appear in the rental catalog and accept requests for available dates.'}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="portal-actions"><button className="button button-outline" onClick={() => setPublication(undefined)} disabled={busy}>Go back</button><button className="button primary" onClick={updatePublication} disabled={busy}>{busy ? 'Saving…' : publication.active ? 'Archive bike' : 'Publish bike'}</button></div>
      </div>
    </Dialog>}
  </section>
}

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
