import { categories } from '../../../../shared/fleet.ts'
import { money } from '../../../../shared/rental.ts'
import type { Filters } from '../../../../shared/types.ts'

export const engineRanges = [
  { value: '0-160', label: 'Up to 160 cc', low: 0, high: 160 },
  { value: '161-350', label: '161–350 cc', low: 161, high: 350 },
  { value: '351-500', label: '351 cc and above', low: 351, high: Infinity },
]
const prices = ['500', '800', '1000', '1250', '1500']

export function FilterPanel({ filters, brands, update, clear }: { filters: Filters; brands: string[]; update: (patch: Partial<Filters>) => void; clear: () => void }) {
  return <div className="filter-panel">
    <div className="filter-heading"><h2>Filters</h2><button className="text-button" type="button" onClick={clear}>Clear Filters</button></div>
    <label className="field"><span>Category</span><select value={filters.category} onChange={event => update({ category: event.target.value })}><option value="">All categories</option>{categories.map(category => <option key={category.name}>{category.name}</option>)}</select></label>
    <label className="field"><span>Brand</span><select value={filters.brand} onChange={event => update({ brand: event.target.value })}><option value="">All brands</option>{brands.map(brand => <option key={brand}>{brand}</option>)}</select></label>
    <label className="field"><span>Daily rental price</span><select value={filters.maxPrice} onChange={event => update({ maxPrice: event.target.value })}><option value="">Any price</option>{prices.map(price => <option key={price} value={price}>Up to {money(Number(price))}</option>)}</select></label>
    <label className="field"><span>Engine capacity</span><select value={filters.engine} onChange={event => update({ engine: event.target.value })}><option value="">Any engine size</option>{engineRanges.map(range => <option key={range.value} value={range.value}>{range.label}</option>)}</select></label>
    <label className="field"><span>Transmission</span><select value={filters.transmission} onChange={event => update({ transmission: event.target.value })}><option value="">Any transmission</option><option>Manual</option><option>Automatic</option></select></label>
  </div>
}
