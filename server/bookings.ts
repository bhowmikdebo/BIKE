import { randomUUID } from 'node:crypto'
import { bikeName } from '../src/data/fleet.ts'
import type { Account, BookingInput, BookingRecord, BookingStatus } from '../src/types.ts'
import { today } from '../src/utils/rental.ts'
import type { Db } from './db.ts'
import { transaction } from './db.ts'
import { quoteBike } from './fleet.ts'
import { HttpError } from './http.ts'
import { statusTransitions } from './validation.ts'

const columns = `
  id, bike_id AS bikeId, bike_name AS bikeName, rider_name AS riderName, rider_email AS riderEmail,
  phone, city, pickup, return_date AS returnDate, days, daily_rate AS dailyRate, total,
  status, created_at AS createdAt
`

export function listBookings(db: Db, user?: Account) {
  const rows = user ? db.prepare(`SELECT ${columns} FROM bookings WHERE user_id = ? ORDER BY created_at DESC`).all(user.id) :
    db.prepare(`SELECT ${columns} FROM bookings ORDER BY created_at DESC`).all()
  return rows.map(row => row as unknown as BookingRecord)
}

export function bookBike(db: Db, account: Account, input: BookingInput) {
  return transaction(db, () => {
    const existing = db.prepare(`SELECT ${columns} FROM bookings WHERE user_id = ? AND request_key = ?`)
      .get(account.id, input.requestKey) as BookingRecord | undefined
    if (existing) {
      if (existing.bikeId !== input.bikeId || existing.pickup !== input.pickup || existing.returnDate !== input.returnDate ||
        existing.city.toLowerCase() !== input.city.toLowerCase() || existing.dailyRate !== input.dailyRate ||
        existing.riderName !== input.riderName || existing.phone !== input.phone) throw new HttpError(409, 'A different booking was submitted. Refresh before trying again.')
      return existing
    }

    const { bike, quote } = quoteBike(db, input.bikeId, input)
    if (quote.dailyRate !== input.dailyRate) throw new HttpError(409, 'The daily rate changed. Review the latest quote before booking.')
    const city = bike.cities.find(item => item.toLowerCase() === input.city.toLowerCase())!
    const id = `RD-${randomUUID().slice(0, 13).replace('-', '').toUpperCase()}`
    const record: BookingRecord = {
      id, bikeId: bike.id, bikeName: bikeName(bike), riderName: input.riderName, riderEmail: account.email,
      phone: input.phone, city, pickup: input.pickup, returnDate: input.returnDate, ...quote,
      status: 'pending', createdAt: new Date().toISOString(),
    }
    db.prepare(`
      INSERT INTO bookings (
        id, user_id, bike_id, bike_name, rider_name, rider_email, phone, city, pickup, return_date,
        days, daily_rate, total, status, created_at, request_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, account.id, bike.id, record.bikeName, record.riderName, record.riderEmail, record.phone, city,
      record.pickup, record.returnDate, record.days, record.dailyRate, record.total, record.status, record.createdAt, input.requestKey)
    return record
  })
}

export function changeBooking(db: Db, id: string, account: Account, next: BookingStatus) {
  return transaction(db, () => {
    const booking = db.prepare(`SELECT ${columns}, user_id AS owner FROM bookings WHERE id = ?`).get(id) as
      (BookingRecord & { owner: string }) | undefined
    if (!booking || (account.role !== 'admin' && booking.owner !== account.id)) throw new HttpError(404, 'Booking not found.')
    const { owner: _owner, ...record } = booking
    if (account.role === 'customer' && (next !== 'cancelled' || booking.pickup < today())) {
      throw new HttpError(403, 'This booking can only be changed by an administrator.')
    }
    if (booking.status === next) return record
    if (!statusTransitions[booking.status].includes(next)) throw new HttpError(409, 'This status change is unavailable.')
    if (next === 'in_progress' && booking.pickup > today()) throw new HttpError(409, 'Pickup cannot be recorded before the scheduled day.')
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(next, id)
    return { ...record, status: next }
  })
}
