import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { AsyncState, Dialog, ImageAsset } from '../../components/ui'
import { bikeImage, bikeName } from '../../data/fleet'
import { useApi } from '../../hooks/api'
import type { ManagedBike } from '../../types'
import { api, errorMessage } from '../../utils/api'
import { money } from '../../utils/rental'
import { BikeEditor } from './BikeEditor'

function FleetManager() {
  const fleet = useApi<ManagedBike[]>('/api/admin/bikes')
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
      const bike = await api<ManagedBike>(`/api/admin/bikes/${publication.id}/publication`, { method: 'PATCH', body: { active: !publication.active } })
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
    <div className="portal-toolbar"><div><h2 id="fleet-manager">Fleet inventory</h2><p>{fleet.data ? `${fleet.data.filter(bike => bike.active).length} published of ${fleet.data.length} bikes` : 'Manage bike listings, rates, and pickup cities.'}</p></div>
      <button className="button primary" type="button" onClick={() => setEditor('new')}><Plus size={18} />Add bike</button>
    </div>
    {message && <p className="form-success" role="status">{message}</p>}
    <label className="catalog-search admin-search"><Search size={18} /><span className="sr-only">Search fleet by name</span><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Search fleet by name" /></label>
    {!filtered ? <AsyncState error={fleet.error} onRetry={fleet.reload} label="Loading the fleet…" /> :
      !filtered.length ? <p className="async-state">{query ? 'No bikes match your search.' : 'Add a bike to start building the fleet.'}</p> :
        <div className="admin-fleet">{filtered.map(bike => <article className="panel inventory-row" key={bike.id}>
          <ImageAsset className="inventory-image" width={120} height={80} src={bike.hasUploadedImage ? `/api/bikes/${bike.id}/image` : bikeImage(bike)} alt="" loading="lazy" />
          <div className="inventory-name"><p className="bike-brand">{bike.brand}</p><h3>{bike.model}</h3><p>{bike.category} · {bike.cities.join(', ')}</p></div>
          <div className="inventory-rate"><strong>{money(bike.price)}</strong><small> / day</small></div>
          <span className={`status-pill ${bike.active ? 'status-confirmed' : 'status-cancelled'}`}>{bike.active ? 'Published' : 'Archived'}</span>
          <div className="portal-actions"><button className="button button-outline" type="button" onClick={() => setEditor(bike)} aria-label={`Edit ${bikeName(bike)}`}>Edit</button><button className="button button-outline" type="button" onClick={() => { setPublication(bike); setError('') }} aria-label={`${bike.active ? 'Archive' : 'Publish'} ${bikeName(bike)}`}>{bike.active ? 'Archive' : 'Publish'}</button></div>
        </article>)}</div>}
    {editor && <BikeEditor bike={editor === 'new' ? undefined : editor} onClose={() => setEditor(undefined)} onSaved={bike => {
      setMessage(`${bikeName(bike)} was saved.`)
      setEditor(undefined)
      fleet.reload()
    }} />}
    {publication && <Dialog title={publication.active ? 'Archive this bike?' : 'Publish this bike?'} onClose={() => { if (!busy) setPublication(undefined) }}>
      <div className="dialog-body"><p>{publication.active ? 'New customers will no longer see this bike in the catalog. Existing reservations stay in the booking list.' : 'The bike will appear in the rental catalog and accept requests for available dates.'}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="portal-actions"><button className="button button-outline" onClick={() => setPublication(undefined)} disabled={busy}>Go back</button><button className="button primary" onClick={updatePublication} disabled={busy}>{busy ? 'Saving…' : publication.active ? 'Archive bike' : 'Publish bike'}</button></div>
      </div>
    </Dialog>}
  </section>
}

export function Admin() {
  return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">RIDEON administration</p><h1>Admin portal</h1><p>Manage rental bikes and review customer reservations.</p></div></section>
    <div className="container portal-content"><FleetManager /></div>
  </>
}
