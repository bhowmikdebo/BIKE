import { categories } from '../src/data/fleet.ts'
import type { BikeInput, BookingInput, BookingStatus, RentalSearch } from '../src/types.ts'
import { dateError } from '../src/utils/rental.ts'
import { HttpError } from './http.ts'

export const uploadLimit = 2 * 1024 * 1024

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

function list(value: unknown, label: string, max: number) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) {
    throw new HttpError(400, `${label} must contain 1 to ${max} entries.`)
  }
  return [...new Set(value.map(item => text(item, label, 90)))]
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

function imageUrl(value: unknown) {
  const url = text(value, 'Image URL', 400, true)
  if (!url || /^\/images\/[a-z\d-]+\.webp$/i.test(url)) return url
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href
  } catch { /* Invalid URL is reported below. */ }
  throw new HttpError(400, 'Enter an HTTPS image URL or use an uploaded image.')
}

export function bikeInput(value: unknown): BikeInput {
  const raw = object(value)
  const category = categories.find(item => item.name === raw.category)?.name
  if (!category) throw new HttpError(400, 'Select a bike category.')
  if (raw.transmission !== 'Manual' && raw.transmission !== 'Automatic') throw new HttpError(400, 'Select a transmission.')
  if (typeof raw.active !== 'boolean') throw new HttpError(400, 'Select a publication status.')
  if (raw.image !== null && raw.image !== undefined && typeof raw.image !== 'string') throw new HttpError(400, 'Invalid image upload.')
  return {
    brand: text(raw.brand, 'Brand', 80), model: text(raw.model, 'Model', 80), category,
    engine: integer(raw.engine, 'Engine capacity', 1, 5000), transmission: raw.transmission,
    mileage: integer(raw.mileage, 'Mileage', 1, 500), fuel: 'Petrol', seats: integer(raw.seats, 'Seats', 1, 2),
    price: integer(raw.price, 'Daily rate', 1, 1_000_000), cities: list(raw.cities, 'Pickup cities', 20),
    features: list(raw.features, 'Features', 20), description: text(raw.description, 'Description', 1800),
    imageUrl: imageUrl(raw.imageUrl), image: raw.image, active: raw.active,
  }
}

export function uploadedImage(value: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z\d+/]+=*)$/i.exec(value)
  if (!match) throw new HttpError(400, 'Upload a JPG, PNG or WebP image.')
  const data = Buffer.from(match[2], 'base64')
  if (data.length > uploadLimit) throw new HttpError(413, 'Upload an image under 2 MB.')
  const mime = match[1].toLowerCase()
  const signature = mime === 'image/jpeg' ? data.subarray(0, 3).equals(Buffer.from([255, 216, 255])) :
    mime === 'image/png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
      data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP'
  if (!signature || data.length < 16) throw new HttpError(400, 'The image does not match its file format.')
  return { mime, data }
}

export const statusTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}
