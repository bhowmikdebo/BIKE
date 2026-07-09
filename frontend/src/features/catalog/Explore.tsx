import { useState } from 'react'
import { Heart, Search, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { BikeGrid } from './BikeCard'
import { BikeComparison } from './BikeComparison'
import { engineRanges, FilterPanel } from './FilterPanel'
import { SearchBar } from './Search'
import { AsyncState, Dialog, EmptyState } from '../../components/ui'
import { bikeName } from '../../../../shared/fleet.ts'
import { useApi } from '../../hooks/api'
import { useFavorites } from '../../hooks/favorites'
import type { Bike, Filters } from '../../../../shared/types.ts'
import { dateError, readFilters, rentalSearch, searchString } from '../../../../shared/rental.ts'

export function Explore() {
  const [params, setParams] = useSearchParams()
  const [drawer, setDrawer] = useState(false)
  const [comparison, setComparison] = useState<string[]>([])
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
    <BikeComparison compared={compared} selectedCount={comparison.length} compareMessage={compareMessage}
      bookingQuery={bookingQuery} onClear={() => { setComparison([]); setCompareMessage('') }} />
  </>
}
