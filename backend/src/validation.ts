import type { RentalSearch } from '../../shared/types.ts'
import { dateError } from '../../shared/rental.ts'
import { HttpError } from './http.ts'

export function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new HttpError(400, 'Invalid request data.')
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, max: number, optional = false) {
  if (optional && (value === undefined || value === '')) return ''
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${label} must contain 1 to ${max} characters.`)
  }
  return value.trim()
}

export function accountEmail(value: unknown) {
  const email = text(value, 'Email', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}

export function password(value: unknown, create = false) {
  if (typeof value !== 'string' || value.length < (create ? 12 : 1) || value.length > 128) {
    throw new HttpError(400, create ? 'Use a password with 12 to 128 characters.' : 'Enter your password.')
  }
  return value
}

export const accountName = (value: unknown) => text(value, 'Name', 100)

export function rental(raw: Record<string, unknown>, required: boolean): RentalSearch {
  const city = text(raw.city, 'Pickup city', 90, !required)
  const pickup = text(raw.pickup, 'Pickup date', 10, !required)
  const returnDate = text(raw.returnDate, 'Return date', 10, !required)
  const error = dateError(pickup, returnDate, required)
  if (error) throw new HttpError(400, error)
  return { city, pickup, returnDate }
}
