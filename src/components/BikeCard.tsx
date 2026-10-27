import { Fuel, Gauge, GitCompareArrows, Heart } from 'lucide-react'
import { Link } from 'react-router'
import { bikeImage, bikeName } from '../data/fleet'
import { useFavorites } from '../hooks/favorites'
import type { Bike } from '../types'
import { money } from '../utils/rental'
import { ImageAsset } from './ui'

export function BikeCard({ bike, query = '', compare }: { bike: Bike; query?: string; compare?: { selected: boolean; toggle: () => void } }) {
  const { ids, toggle } = useFavorites()
  const saved = ids.includes(bike.id)
  const path = `/bikes/${bike.id}`
  return <article className="bike-card">
    <div className="bike-card-media">
      <Link to={path + query} tabIndex={-1} aria-hidden="true"><ImageAsset src={bikeImage(bike)} alt="" loading="lazy" width={508} height={337} /></Link>
      <span className="category-pill">{bike.category}</span>
      <button className={`icon-button favorite ${saved ? 'favorite-active' : ''}`} type="button" onClick={() => toggle(bike.id)} aria-pressed={saved} aria-label={`Favorite ${bikeName(bike)}`}><Heart size={19} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="bike-card-body">
      <p className="bike-brand">{bike.brand}</p>
      <h3><Link to={path + query}>{bike.model}</Link></h3>
      <div className="bike-meta"><span><Gauge size={16} />{bike.engine} cc</span><span><Fuel size={16} />{bike.transmission}</span></div>
      <div className="bike-card-price"><strong>{money(bike.price)}</strong><span> / day</span></div>
      <div className="bike-card-actions"><Link className="button button-outline" to={path + query}>View Details</Link><Link className="button primary" to={path + query + '#reserve'}>Rent Now</Link></div>
      {compare && <button className={`compare-toggle ${compare.selected ? 'compare-selected' : ''}`} type="button" aria-pressed={compare.selected} onClick={compare.toggle}><GitCompareArrows size={16} />{compare.selected ? 'Selected for comparison' : 'Add to compare'}</button>}
    </div>
  </article>
}

export function BikeGrid({ bikes, query, comparison }: { bikes: Bike[]; query?: string; comparison?: { ids: string[]; toggle: (id: string) => void } }) {
  return <div className="bike-grid grid">{bikes.map(bike => <BikeCard key={bike.id} bike={bike} query={query} compare={comparison ? { selected: comparison.ids.includes(bike.id), toggle: () => comparison.toggle(bike.id) } : undefined} />)}</div>
}
