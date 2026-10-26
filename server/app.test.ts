import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { Bike, BookingRecord, ManagedBike } from '../src/types.ts'
import { addDays, today } from '../src/utils/rental.ts'
import { createApp } from './app.ts'
import { createAccount } from './auth.ts'
import { listBookings } from './bookings.ts'
import { openDatabase } from './db.ts'
import { listManagedBikes } from './fleet.ts'

const secret = 'local-test-password-582'
const pickup = today()
const returnDate = addDays(pickup, 3)
const city = 'Mysuru'
const rental = { city, pickup, returnDate }
const photo = readFileSync(new URL('../public/images/activa-6g.webp', import.meta.url))
const bikeInput = {
  brand: 'Test', model: 'City Scooter', category: 'Scooters', transmission: 'Automatic',
  engine: 110, mileage: 48, seats: 2, price: 550, cities: [city], active: true,
  features: ['Storage'], description: 'A commuter scooter for this test.',
  image: `data:image/webp;base64,${photo.toString('base64')}`,
}

test('admin fleet and rider booking workflows persist and protect availability', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'rideon-test-'))
  const database = join(dir, 'rideon.sqlite')
  const db = openDatabase(database)
  t.after(() => { db.close(); rmSync(dir, { recursive: true, force: true }) })
  await createAccount(db, 'Test Operator', 'operator@example.com', secret, 'admin')
  const server = createApp(db)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const request = (path: string, method = 'GET', body?: unknown, cookie = '', headers: Record<string, string> = {}) =>
    fetch(base + path, { method, headers: { cookie, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const session = (response: Response) => {
    const header = response.headers.get('set-cookie')
    assert.match(header ?? '', /HttpOnly; SameSite=Lax/)
    return header!.split(';')[0]
  }

  assert.equal((await request('/api/admin/bikes')).status, 401)
  assert.equal((await request('/api/auth/register', 'POST', { email: 'other@example.com' }, '', { Origin: 'https://unrelated.example' })).status, 403)
  const adminLogin = await request('/api/auth/sign-in', 'POST', { email: 'operator@example.com', password: secret })
  assert.equal(adminLogin.status, 200)
  const admin = session(adminLogin)
  const signup = await request('/api/auth/register', 'POST', { email: 'rider@example.com', password: secret, name: 'First Rider', role: 'admin' })
  assert.equal(signup.status, 201)
  const rider = session(signup)
  assert.equal((await signup.json() as { role: string }).role, 'customer')
  const anotherSignup = await request('/api/auth/register', 'POST', { email: 'different@example.com', password: secret, name: 'Second Rider' })
  const anotherRider = session(anotherSignup)
  assert.equal((await request('/api/admin/bikes', 'POST', bikeInput, rider)).status, 403)

  const created = await request('/api/admin/bikes', 'POST', bikeInput, admin)
  assert.equal(created.status, 201)
  const bike = await created.json() as ManagedBike
  assert.equal(bike.hasUploadedImage, true)
  const availability = '?' + new URLSearchParams(rental)
  const list = async (query = '') => await (await request('/api/bikes' + query)).json() as Bike[]
  const available = await list(availability)
  assert.equal(available.length, 1)
  assert.equal(available[0].id, bike.id)
  assert.deepEqual(Buffer.from(await (await request(available[0].imageUrl!)).arrayBuffer()), photo)
  const quote = await request(`/api/bikes/${bike.id}/availability${availability}`)
  assert.deepEqual(await quote.json(), { days: 3, dailyRate: 550, total: 1650 })

  const input = { ...rental, bikeId: bike.id, riderName: 'Test Rider', phone: '9876543210', agreement: true, dailyRate: 550 }
  assert.equal((await request('/api/bookings', 'POST', { ...input, requestKey: randomUUID() })).status, 401)
  assert.equal((await request('/api/bookings', 'POST', { ...input, dailyRate: 1, requestKey: randomUUID() }, rider)).status, 409)

  const key = randomUUID()
  const anotherKey = randomUUID()
  const simultaneous = await Promise.all([
    request('/api/bookings', 'POST', { ...input, requestKey: key }, rider),
    request('/api/bookings', 'POST', { ...input, requestKey: anotherKey }, anotherRider),
  ])
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [201, 409])
  const winner = simultaneous[0].status === 201 ? rider : anotherRider
  const loser = winner === rider ? anotherRider : rider
  const reservation = await simultaneous.find(result => result.status === 201)!.json() as BookingRecord
  assert.equal(reservation.total, 1650)
  assert.equal((await list(availability)).length, 0)
  const adjacent = await list('?' + new URLSearchParams({ city, pickup: returnDate, returnDate: addDays(returnDate, 1) }))
  assert.equal(adjacent[0].id, bike.id)
  assert.deepEqual(await (await request('/api/bookings', 'GET', undefined, loser)).json(), [])
  assert.equal((await request(`/api/bookings/${reservation.id}/status`, 'PATCH', { status: 'cancelled' }, loser)).status, 404)
  assert.equal((await request(`/api/bookings/${reservation.id}/status`, 'PATCH', { status: 'confirmed' }, winner)).status, 403)
  const retry = await request('/api/bookings', 'POST', { ...input, requestKey: winner === rider ? key : anotherKey }, winner)
  assert.equal((await retry.json() as BookingRecord).id, reservation.id)

  const updated = await request(`/api/admin/bikes/${bike.id}`, 'PUT', { ...bikeInput, image: undefined, price: 650 }, admin)
  assert.equal(updated.status, 200)
  assert.equal((await updated.json() as ManagedBike).hasUploadedImage, true)
  for (const status of ['confirmed', 'in_progress', 'completed']) {
    const change = await request(`/api/admin/bookings/${reservation.id}/status`, 'PATCH', { status }, admin)
    assert.equal(change.status, 200)
    assert.equal((await change.json() as BookingRecord).status, status)
  }
  assert.equal((await list(availability)).length, 1)
  const second = await request('/api/bookings', 'POST', { ...input, requestKey: randomUUID(), dailyRate: 650 }, winner)
  assert.equal(second.status, 201)
  const secondBooking = await second.json() as BookingRecord
  assert.equal((await request(`/api/bookings/${secondBooking.id}/status`, 'PATCH', { status: 'cancelled' }, winner)).status, 200)
  assert.equal((await request(`/api/admin/bikes/${bike.id}/publication`, 'PATCH', { active: false }, admin)).status, 200)
  assert.equal((await list(availability)).length, 0)

  const reopened = openDatabase(database)
  try {
    assert.equal(listManagedBikes(reopened).find(item => item.id === bike.id)?.price, 650)
    assert.equal(listManagedBikes(reopened).find(item => item.id === bike.id)?.active, false)
    assert.equal(listBookings(reopened).find(item => item.id === reservation.id)?.total, 1650)
  } finally {
    reopened.close()
  }

  const logout = await request('/api/auth/sign-out', 'POST', undefined, winner)
  assert.equal(logout.status, 200)
  assert.equal((await request('/api/bookings', 'GET', undefined, winner)).status, 401)
})
