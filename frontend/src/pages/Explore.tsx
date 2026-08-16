import { useState } from 'react'
import { GitCompareArrows, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { BikeGrid } from '../components/BikeCard'
import { SearchBar } from '../components/Search'
import { AsyncState, Dialog, EmptyState, ImageAsset } from '../components/ui'
import { bikeImage, bikeName, categories } from '../../../shared/fleet.ts'
import { useApi } from '../hooks/api'
import { useFavorites } from '../hooks/favorites'
import type { Bike, Filters } from '../../../shared/types.ts'
import { dateError, money, readFilters, rentalSearch, searchString } from '../../../shared/rental.ts'

const engineRanges = [
  { value: '0-160', label: 'Up to 160 cc', low: 0, high: 160 },
  { value: '161-350', label: '161–350 cc', low: 161, high: 350 },
  { value: '351-500', label: '351 cc and above', low: 351, high: Infinity },
]
const prices = ['500', '800', '1000', '1250', '1500']

function FilterPanel({ filters, brands, update, clear }: { filters: Filters; brands: string[]; update: (patch: Partial<Filters>) => void; clear: () => void }) {
  return <div className="filter-panel">
    <div className="filter-heading"><h2>Filters</h2><button className="text-button" type="button" onClick={clear}>Clear Filters</button></div>
    <label className="field"><span>Category</span><select value={filters.category} onChange={event => update({ category: event.target.value })}><option value="">All categories</option>{categories.map(category => <option key={category.name}>{category.name}</option>)}</select></label>
    <label className="field"><span>Brand</span><select value={filters.brand} onChange={event => update({ brand: event.target.value })}><option value="">All brands</option>{brands.map(brand => <option key={brand}>{brand}</option>)}</select></label>
    <label className="field"><span>Daily rental price</span><select value={filters.maxPrice} onChange={event => update({ maxPrice: event.target.value })}><option value="">Any price</option>{prices.map(price => <option key={price} value={price}>Up to {money(Number(price))}</option>)}</select></label>
    <label className="field"><span>Engine capacity</span><select value={filters.engine} onChange={event => update({ engine: event.target.value })}><option value="">Any engine size</option>{engineRanges.map(range => <option key={range.value} value={range.value}>{range.label}</option>)}</select></label>
    <label className="field"><span>Transmission</span><select value={filters.transmission} onChange={event => update({ transmission: event.target.value })}><option value="">Any transmission</option><option>Manual</option><option>Automatic</option></select></label>
  </div>
}

export function Explore() {
  const [params, setParams] = useSearchParams()
  const [drawer, setDrawer] = useState(false)
  const [comparison, setComparison] = useState<string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareMessage, setCompareMessage] = useState('')
  const { ids: favoriteIds } = useFavorites()
  const filters = readFilters(params)
  const sort = params.get('sort') ?? ''
  const saved = params.get('saved') === '1'
  const bookingQuery = searchString(rentalSearch(filters))
  const invalidDates = dateError(filters.pickup, filters.returnDate, false)
  const catalog = useApi<Bike[]>('/api/bikes')
  const availability = useApi<Bike[]>(!invalidDates && bookingQuery ? '/api/bikes' + bookingQuery : null)
  const fleet = bookingQuery && !invalidDates ? availability : catalog
  const bikes = fleet.data ?? []
  const catalogBikes = catalog.data ?? []
  const cities = catalog.data ? [...new Set(catalogBikes.flatMap(bike => bike.cities))].sort() : undefined
  const brands = [...new Set(catalogBikes.map(bike => bike.brand))].sort()

  function update(patch: Partial<Filters>, replace = false) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace, preventScrollReset: true })
  }
  function setOption(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }
  function clear() {
    setParams(saved ? { saved: '1' } : {})
  }
  function toggleCompare(id: string) {
    if (!comparison.includes(id) && comparison.length === 3) {
      setCompareMessage('Compare up to three bikes. Remove a bike to add another.')
      return
    }
    setCompareMessage('')
    setComparison(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const range = engineRanges.find(item => item.value === filters.engine)
  const query = filters.query.toLowerCase().trim()
  const results = invalidDates ? [] : bikes.filter(bike =>
    (!saved || favoriteIds.includes(bike.id)) &&
    (!query || `${bikeName(bike)} ${bike.category} ${bike.transmission} ${bike.host?.name ?? ''}`.toLowerCase().includes(query)) &&
    (!filters.brand || filters.brand === bike.brand) &&
    (!filters.category || filters.category === bike.category) &&
    (!filters.maxPrice || bike.price <= Number(filters.maxPrice)) &&
    (!range || (bike.engine >= range.low && bike.engine <= range.high)) &&
    (!filters.transmission || filters.transmission === bike.transmission))
  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price)
  if (sort === 'price-desc') results.sort((a, b) => b.price - a.price)
  if (sort === 'name') results.sort((a, b) => bikeName(a).localeCompare(bikeName(b)))
  const compared = comparison.flatMap(id => catalogBikes.filter(bike => bike.id === id))

  return <>
    <section className="page-banner"><div className="container"><p className="eyebrow">RIDEON marketplace</p><h1>{saved ? 'Saved bikes' : 'Explore bikes'}</h1><p>{saved ? 'Keep your favorite rides within reach.' : 'Find a motorcycle or scooter for your route, dates and budget.'}</p></div></section>
    <div className="container listing-shell">
      <SearchBar key={`${bookingQuery}|${filters.category}`} initial={rentalSearch(filters)} category={filters.category} cityOptions={cities} onSearch={value => update(value)} />
      <div className="listing-layout grid">
        <aside className="desktop-filters"><FilterPanel filters={filters} brands={brands} update={update} clear={clear} /></aside>
        <section aria-label="Matching bikes" className="listing-results">
          <div className="listing-tools">
            <label className="catalog-search"><Search size={18} /><span className="sr-only">Search by model or brand</span><input type="search" value={filters.query} placeholder="Search by model or brand" onChange={event => update({ query: event.target.value }, true)} /></label>
            <button type="button" className="button button-outline mobile-filter" onClick={() => setDrawer(true)}><SlidersHorizontal size={17} />Filters</button>
          </div>
          <div className="result-bar"><div className="result-count"><strong aria-live="polite">{results.length} {results.length === 1 ? 'bike' : 'bikes'}</strong><span>Marketplace</span></div><div className="result-actions">
            <button type="button" className={`button button-outline saved-filter ${saved ? 'is-active' : ''}`} aria-pressed={saved} onClick={() => setOption('saved', saved ? '' : '1')}><Heart size={16} fill={saved ? 'currentColor' : 'none'} />Saved</button>
            <label className="sort-select"><span className="sr-only">Sort bikes</span><select value={sort} onChange={event => setOption('sort', event.target.value)}><option value="">Sort by</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="name">Name: A to Z</option></select></label>
          </div></div>
          {!invalidDates && (fleet.loading || fleet.error) ? <AsyncState label="Checking available bikes…" error={fleet.error} onRetry={fleet.reload} /> :
          results.length ? <BikeGrid bikes={results} query={bookingQuery} comparison={{ ids: comparison, toggle: toggleCompare }} /> :
            <EmptyState title={invalidDates ? 'Check your rental dates' : saved ? 'No saved bikes match' : 'No bikes match your search'} description={invalidDates || (saved ? 'Save a ride using the heart on any bike card, or adjust your filters.' : 'Try another city or date range, or clear your filters to see more of the fleet.')} action={<button className="button primary" type="button" onClick={saved ? () => setParams({}) : clear}>{saved ? 'Explore all bikes' : 'Clear Filters'}</button>} />}
        </section>
      </div>
    </div>
    {drawer && <Dialog title="Filter bikes" className="filter-drawer" onClose={() => setDrawer(false)}><FilterPanel filters={filters} brands={brands} update={update} clear={clear} /><button className="button primary w-full" type="button" onClick={() => setDrawer(false)}>Show {results.length} {results.length === 1 ? 'bike' : 'bikes'}</button></Dialog>}
    {comparison.length > 0 && <aside className="compare-tray" aria-label="Selected bikes to compare">
      <div><GitCompareArrows size={20} /><span><strong>{comparison.length} selected</strong><small role="status">{compareMessage || 'Select 2 or 3 bikes'}</small></span></div>
      <div><button type="button" className="icon-button" aria-label="Clear comparison" onClick={() => { setComparison([]); setCompareMessage('') }}><X size={18} /></button><button type="button" className="button primary" disabled={comparison.length < 2} onClick={() => setCompareOpen(true)}>Compare</button></div>
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
