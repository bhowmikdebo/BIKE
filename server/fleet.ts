import { randomUUID } from 'node:crypto'
import type { Bike, BikeInput, ManagedBike, RentalSearch } from '../src/types.ts'
import { rentalDays } from '../src/utils/rental.ts'
import type { Db } from './db.ts'
import { transaction } from './db.ts'
import { HttpError } from './http.ts'
import { uploadedImage } from './validation.ts'

type BikeRow = { id: string; data: string; active: number; uploaded: number }
const selectBike = 'SELECT b.*, EXISTS (SELECT 1 FROM bike_images i WHERE i.bike_id = b.id) AS uploaded FROM bikes b'
const busyBookings = "status IN ('pending', 'confirmed', 'in_progress')"

function unpackBike(row: BikeRow, forAdmin: true): ManagedBike
function unpackBike(row: BikeRow, forAdmin: false): Bike
function unpackBike(row: BikeRow, forAdmin: boolean) {
  const data = JSON.parse(row.data) as Omit<Bike, 'id'>
  const bike: Bike = { ...data, id: row.id }
  if (forAdmin) return { ...bike, active: Boolean(row.active), hasUploadedImage: Boolean(row.uploaded) }
  if (row.uploaded) bike.imageUrl = `/api/bikes/${row.id}/image`
  return bike
}

function bikeRow(db: Db, id: string) {
  return db.prepare(`${selectBike} WHERE b.id = ?`).get(id) as BikeRow | undefined
}

export function listPublicBikes(db: Db, search: RentalSearch) {
  const rows = db.prepare(`
    ${selectBike}
    WHERE b.active = 1
      AND (? = '' OR EXISTS (SELECT 1 FROM json_each(b.data, '$.cities') WHERE value = ? COLLATE NOCASE))
      AND (? = '' OR NOT EXISTS (
        SELECT 1 FROM bookings WHERE bike_id = b.id AND ${busyBookings}
          AND pickup < ? AND return_date > ?
      ))
    ORDER BY b.rowid
  `).all(search.city, search.city, search.pickup, search.returnDate, search.pickup) as BikeRow[]
  return rows.map(row => unpackBike(row, false))
}

export function listManagedBikes(db: Db) {
  const rows = db.prepare(`${selectBike} ORDER BY b.rowid DESC`).all() as BikeRow[]
  return rows.map(row => unpackBike(row, true))
}

export function bikeImage(db: Db, id: string) {
  return db.prepare('SELECT mime, bytes FROM bike_images WHERE bike_id = ?').get(id) as { mime: string; bytes: Uint8Array } | undefined
}

export function saveBike(db: Db, input: BikeInput, existingId?: string) {
  const id = existingId || `${`${input.brand}-${input.model}`.toLowerCase().replace(/[^a-z\d]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'bike'}-${randomUUID().slice(0, 12)}`
  const { active, image, ...bike } = input
  const uploaded = typeof image === 'string' ? uploadedImage(image) : undefined

  return transaction(db, () => {
    if (existingId && !bikeRow(db, id)) throw new HttpError(404, 'Bike not found.')
    db.prepare(`
      INSERT INTO bikes (id, data, active) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, active = excluded.active
    `).run(id, JSON.stringify(bike), Number(active))
    if (uploaded) {
      db.prepare(`
        INSERT INTO bike_images (bike_id, mime, bytes) VALUES (?, ?, ?)
        ON CONFLICT(bike_id) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes
      `).run(id, uploaded.mime, uploaded.data)
    } else if (image === null) db.prepare('DELETE FROM bike_images WHERE bike_id = ?').run(id)
    return unpackBike(bikeRow(db, id)!, true)
  })
}

export function setBikeActive(db: Db, id: string, active: boolean) {
  if (!db.prepare('UPDATE bikes SET active = ? WHERE id = ?').run(Number(active), id).changes) {
    throw new HttpError(404, 'Bike not found.')
  }
  return unpackBike(bikeRow(db, id)!, true)
}

export function quoteBike(db: Db, bikeId: string, search: RentalSearch) {
  const row = bikeRow(db, bikeId)
  if (!row?.active) throw new HttpError(404, 'This bike is no longer available for booking.')
  const bike = unpackBike(row, false)
  if (!bike.cities.some(city => city.toLowerCase() === search.city.toLowerCase())) {
    throw new HttpError(400, 'Choose a pickup city offered for this bike.')
  }
  const conflict = db.prepare(`
    SELECT 1 FROM bookings WHERE bike_id = ? AND ${busyBookings}
      AND pickup < ? AND return_date > ? LIMIT 1
  `).get(bikeId, search.returnDate, search.pickup)
  if (conflict) throw new HttpError(409, 'This bike is unavailable for those dates.')
  const days = rentalDays(search.pickup, search.returnDate)
  return { bike, quote: { days, dailyRate: bike.price, total: days * bike.price } }
}
