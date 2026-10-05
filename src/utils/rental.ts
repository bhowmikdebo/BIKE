import type { Bike, Filters, RentalSearch } from '../types'

const day = 86_400_000
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
const readableDate = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function today() {
  const parts = Object.fromEntries(dateParts.formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const money = (amount: number) => rupees.format(amount)
export const displayDate = (value: string) => readableDate.format(new Date(value))

function timestamp(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN
}

export function addDays(value: string, count: number) {
  const start = timestamp(value)
  return Number.isFinite(start) ? new Date(start + count * day).toISOString().slice(0, 10) : ''
}

export function rentalDays(pickup: string, returnDate: string) {
  return (timestamp(returnDate) - timestamp(pickup)) / day
}

export function dateError(pickup: string, returnDate: string, required = true) {
  if (!pickup && !returnDate && !required) return ''
  if (!Number.isFinite(timestamp(pickup)) || !Number.isFinite(timestamp(returnDate))) return 'Choose both pickup and return dates.'
  if (pickup < today()) return 'Choose a pickup date from today onward.'
  if (rentalDays(pickup, returnDate) < 1) return 'Choose a return date after pickup.'
  return ''
}

// Stagger two-day service windows across the demo fleet.
export function isAvailable(bike: Bike, search: RentalSearch) {
  if (search.city && !bike.cities.includes(search.city)) return false
  if (!search.pickup || !search.returnDate || dateError(search.pickup, search.returnDate)) return true
  const offset = 7 + bike.id.length % 8
  const serviceStart = addDays(today(), offset)
  const serviceEnd = addDays(serviceStart, 2)
  return search.returnDate <= serviceStart || search.pickup >= serviceEnd
}

export const emptyFilters: Filters = {
  city: '', pickup: '', returnDate: '', query: '', category: '', brand: '', maxPrice: '', engine: '', transmission: '',
}

export function readFilters(params: URLSearchParams): Filters {
  return Object.fromEntries(Object.keys(emptyFilters).map(key => [key, params.get(key) ?? ''])) as unknown as Filters
}

export function searchString(values: Partial<Filters>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
  }
  return params.size ? `?${params}` : ''
}

export function rentalSearch(values: RentalSearch) {
  return { city: values.city, pickup: values.pickup, returnDate: values.returnDate }
}
