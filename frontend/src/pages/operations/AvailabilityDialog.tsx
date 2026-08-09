import { useState } from 'react'
import type { FormEvent } from 'react'
import type { BikeBlock, ManagedBike } from '../../../../shared/types.ts'
import { bikeName } from '../../../../shared/fleet.ts'
import { dateError, displayDate } from '../../../../shared/rental.ts'
import { DateSelector } from '../../components/Search'
import { AsyncState, Dialog } from '../../components/ui'
import { useApi } from '../../hooks/api'
import { api, errorMessage } from '../../utils/api'

export function AvailabilityDialog({ bike, onClose }: { bike: ManagedBike; onClose: () => void }) {
  const endpoint = `/api/host/bikes/${bike.id}/blocks`
  const blocks = useApi<BikeBlock[]>(endpoint)
  const [dates, setDates] = useState({ city: '', pickup: '', returnDate: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function change(block?: BikeBlock) {
    if (busy) return
    if (!block) {
      const invalid = dateError(dates.pickup, dates.returnDate)
      if (invalid) { setError(invalid); return }
    }
    setBusy(true)
    setError('')
    try {
      if (block) await api(`${endpoint}/${block.id}`, { method: 'DELETE' })
      else {
        await api(endpoint, { method: 'POST', body: { pickup: dates.pickup, returnDate: dates.returnDate } })
        setDates({ city: '', pickup: '', returnDate: '' })
      }
      blocks.reload()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void change()
  }

  return <Dialog title="Manage availability" onClose={() => { if (!busy) onClose() }}>
    <div className="dialog-body availability-panel">
      <p><strong>{bikeName(bike)}</strong></p>
      <p>Block time for maintenance or personal use. The bike becomes bookable again on the end date.</p>
      <form className="contact-form" onSubmit={submit}>
        <div className="form-pair"><DateSelector value={dates} onChange={setDates} required labels={['Unavailable from', 'Available again']} /></div>
        <button className="button primary" type="submit" disabled={busy}>Block dates</button>
      </form>
      {error && <p className="field-error" role="alert">{error}</p>}
      <h3>Blocked periods</h3>
      {!blocks.data ? <AsyncState error={blocks.error} onRetry={blocks.reload} label="Loading blocked periods…" /> :
        !blocks.data.length ? <p className="small-note">No upcoming periods are blocked.</p> :
          <ul className="blocked-periods">{blocks.data.map(block => <li key={block.id}>
            <span>{displayDate(block.pickup)} – {displayDate(block.returnDate)}</span>
            <button className="button button-outline" type="button" disabled={busy} onClick={() => void change(block)}>Remove block</button>
          </li>)}</ul>}
    </div>
  </Dialog>
}
