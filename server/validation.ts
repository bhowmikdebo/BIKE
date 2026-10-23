import type { BookingInput, RentalSearch } from '../src/types.ts'
import { dateError } from '../src/utils/rental.ts'
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

function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpError(400, `${label} must be a whole number from ${min} to ${max}.`)
  }
  return value
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

export function bookingInput(value: unknown): BookingInput {
  const raw = object(value)
  const phone = text(raw.phone, 'Phone', 25)
  const digits = phone.replace(/\D/g, '').length
  if (!/^[+()\d .-]+$/.test(phone) || digits < 10 || digits > 15) throw new HttpError(400, 'Enter a valid phone number with 10 to 15 digits.')
  if (raw.agreement !== true) throw new HttpError(400, 'Acknowledge the booking request before submitting.')
  const requestKey = text(raw.requestKey, 'Request key', 60)
  if (!/^[0-9a-f-]{36}$/i.test(requestKey)) throw new HttpError(400, 'Invalid booking request key.')
  return {
    ...rental(raw, true), bikeId: text(raw.bikeId, 'Bike', 90), riderName: accountName(raw.riderName),
    phone, dailyRate: integer(raw.dailyRate, 'Daily rate', 1, 1_000_000), requestKey, agreement: true,
  }
}
