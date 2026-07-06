import { useState } from 'react'
import { GitCompareArrows, X } from 'lucide-react'
import { Link } from 'react-router'
import { bikeImage, bikeName } from '../../../../shared/fleet.ts'
import { money } from '../../../../shared/rental.ts'
import type { Bike } from '../../../../shared/types.ts'
import { Dialog, ImageAsset } from '../../components/ui'

export function BikeComparison({ compared, selectedCount, compareMessage, bookingQuery, onClear }: {
  compared: Bike[]
  selectedCount: number
  compareMessage: string
  bookingQuery: string
  onClear: () => void
}) {
  const [compareOpen, setCompareOpen] = useState(false)
  return <>
    {selectedCount > 0 && <aside className="compare-tray" aria-label="Selected bikes to compare">
      <div><GitCompareArrows size={20} /><span><strong>{selectedCount} selected</strong><small role="status">{compareMessage || 'Select 2 or 3 bikes'}</small></span></div>
      <div><button type="button" className="icon-button" aria-label="Clear comparison" onClick={onClear}><X size={18} /></button><button type="button" className="button primary" disabled={selectedCount < 2} onClick={() => setCompareOpen(true)}>Compare</button></div>
    </aside>}
    {compareOpen && <Dialog title="Compare bikes" className="comparison-dialog" onClose={() => setCompareOpen(false)}><div className="comparison-scroll" tabIndex={0} role="region" aria-label="Bike comparison table">
      <table><thead><tr><th scope="col">Bike</th>{compared.map(bike => <th scope="col" key={bike.id}><ImageAsset src={bikeImage(bike)} alt="" width={508} height={337} />{bikeName(bike)}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Daily rate</th>{compared.map(bike => <td key={bike.id}>{money(bike.price)}</td>)}</tr>
          <tr><th scope="row">Category</th>{compared.map(bike => <td key={bike.id}>{bike.category}</td>)}</tr>
          <tr><th scope="row">Engine</th>{compared.map(bike => <td key={bike.id}>{bike.engine} cc</td>)}</tr>
          <tr><th scope="row">Transmission</th>{compared.map(bike => <td key={bike.id}>{bike.transmission}</td>)}</tr>
          <tr><th scope="row">Pickup cities</th>{compared.map(bike => <td key={bike.id}>{bike.cities.join(', ')}</td>)}</tr>
          <tr><th scope="row">Explore</th>{compared.map(bike => <td key={bike.id}><Link className="button button-outline" to={`/bikes/${bike.id}${bookingQuery}`}>View Details</Link></td>)}</tr>
        </tbody></table></div></Dialog>}
  </>
}
