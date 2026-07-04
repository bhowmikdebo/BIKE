import { useState } from 'react'
import type { FormEvent } from 'react'
import { Bike, CalendarDays, MapPin, Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { categories, cities } from '../../../../shared/fleet.ts'
import type { RentalSearch } from '../../../../shared/types.ts'
import { addDays, dateError, searchString, today } from '../../../../shared/rental.ts'

export function DateSelector({ value, onChange, required = false, icons = false, labels = ['Pickup date', 'Return date'] }: { value: RentalSearch; onChange: (value: RentalSearch) => void; required?: boolean; icons?: boolean; labels?: [string, string] }) {
  return <>
    <label className="field"><span>{labels[0]}</span><span className="field-control">{icons && <CalendarDays size={17} />}<input type="date" required={required} min={today()} value={value.pickup} onChange={event => {
      const pickup = event.target.value
      onChange({ ...value, pickup, returnDate: pickup && value.returnDate <= pickup ? '' : value.returnDate })
    }} /></span></label>
    <label className="field"><span>{labels[1]}</span><span className="field-control">{icons && <CalendarDays size={17} />}<input type="date" required={required} min={addDays(value.pickup || today(), 1)} value={value.returnDate} onChange={event => onChange({ ...value, returnDate: event.target.value })} /></span></label>
  </>
}

export function SearchBar({ initial, category: initialCategory = '', integrated = false, cityOptions = cities, onSearch }: { initial?: RentalSearch; category?: string; integrated?: boolean; cityOptions?: string[]; onSearch?: (values: RentalSearch & { category: string }) => void }) {
  const [value, setValue] = useState<RentalSearch>(initial ?? { city: '', pickup: '', returnDate: '' })
  const [category, setCategory] = useState(initialCategory)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = dateError(value.pickup, value.returnDate, false)
    setError(validation)
    if (validation) return
    if (onSearch) onSearch({ ...value, category })
    else navigate(`/bikes${searchString({ ...value, category })}`)
  }

  return <form className={`rental-search ${integrated ? 'rental-search-integrated' : ''}`} onSubmit={submit} aria-label="Search for a rental">
    <label className="field"><span>Pickup location</span><span className="field-control"><MapPin size={18} /><select value={value.city} onChange={event => setValue({ ...value, city: event.target.value })}><option value="">Select city</option>{cityOptions.map(city => <option key={city}>{city}</option>)}</select></span></label>
    <DateSelector value={value} onChange={next => { setValue(next); setError('') }} icons />
    <label className="field"><span>Bike category</span><span className="field-control"><Bike size={18} /><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.name}>{item.name}</option>)}</select></span></label>
    <button type="submit" className="button primary search-submit"><Search size={18} />Search Bikes</button>
    {error && <p className="field-error search-error" role="alert">{error}</p>}
  </form>
}
