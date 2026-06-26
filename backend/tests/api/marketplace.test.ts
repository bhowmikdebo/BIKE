import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createApp } from '../../src/app.ts'
import { listen, testSession } from './fixtures.ts'
import { randomUUID } from 'node:crypto'
import type { Account } from '../../../shared/types.ts'
import { addDays, today } from '../../../shared/rental.ts'
import { HttpError } from '../../src/http.ts'
import type { SupabaseGateway } from '../../src/supabase.ts'

test('Express forwards validated requests with the current rider identity and protects admin routes', async t => {
  const calls: { name: string; args?: Record<string, unknown>; token?: string }[] = []
  const ended: string[] = []
  const host = { name: 'Rider Garage', slug: 'rider-garage', bio: '' }
  let hostEnabled = false
  let registrationCount = 0
  const gateway: SupabaseGateway = {
    signIn: async email => testSession(email.startsWith('admin') ? 'admin' : 'customer'),
    register: async () => { registrationCount++; return { session: null, verifier: null } },
    startGoogle: async () => ({ url: 'https://example.test/authorize', verifier: 'test-google-verifier' }),
    exchangeSignInCode: async () => null,
    sendRecoveryEmail: async () => null,
    exchangeRecoveryCode: async () => null,
    updateRecoveryPassword: async () => {},
    refresh: async token => token === 'refresh-customer' ? testSession('customer') : null,
    signOut: async token => { ended.push(token) },
    async rpc<T>(name: string, args?: Record<string, unknown>, token?: string) {
      calls.push({ name, args, token })
      if (name === 'account') {
        if (token !== 'customer' && token !== 'admin') throw new HttpError(401, 'Sign in to continue.')
        return { id: token, name: 'Test', email: 'test@example.test', role: token, host: token === 'customer' && hostEnabled ? host : null } as T
      }
      if (name === 'hostProfile') {
        hostEnabled = true
        return { id: token, name: 'Test', email: 'test@example.test', role: 'customer', host } as T
      }
      if (name === 'book') return { id: 'RD-TEST', status: 'pending' } as T
      return [] as T
    },
  }
  const url = await listen(t, createServer(createApp(gateway)))
  const request = (path: string, method = 'GET', body?: unknown, cookie = '', headers: Record<string, string> = {}) =>
    fetch(url + path, { method, headers: { cookie, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const cookies = (response: Response) => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')

  assert.equal((await request('/api/admin/bikes')).status, 401)
  assert.equal((await request('/api/auth/sign-in', 'POST', {}, '', { Origin: 'https://unrelated.example' })).status, 403)
  const signup = { name: 'Rider', email: 'rider@example.test', password: 'temporary-test-password' }
  assert.equal((await request('/api/auth/register', 'POST', { ...signup, confirmPassword: 'a-different-password' })).status, 400)
  assert.equal(registrationCount, 0)
  const registered = await request('/api/auth/register', 'POST', { ...signup, confirmPassword: signup.password })
  assert.equal(registered.status, 201)
  assert.equal(await registered.json(), null)
  assert.equal(registered.headers.getSetCookie().length, 0)

  const signedIn = await request('/api/auth/sign-in', 'POST', { email: 'rider@example.test', password: 'temporary-test-password' })
  assert.equal(signedIn.status, 200)
  assert(signedIn.headers.getSetCookie().every(cookie => cookie.includes('HttpOnly') && cookie.includes('SameSite=Lax')))
  const rider = cookies(signedIn)
  const admin = cookies(await request('/api/auth/sign-in', 'POST', { email: 'admin@example.test', password: 'temporary-test-password' }))
  assert.equal((await request('/api/admin/bikes', 'GET', undefined, rider)).status, 403)
  assert.equal((await request('/api/admin/bikes', 'GET', undefined, admin)).status, 200)
  assert.equal(calls.at(-1)?.token, 'admin')

  assert.equal((await request('/api/host/bikes')).status, 401)
  assert.equal((await request('/api/host/bikes', 'GET', undefined, rider)).status, 403)
  const onboarded = await request('/api/host/profile', 'PUT', { ...host, role: 'admin', userId: 'another-user' }, rider)
  assert.equal(onboarded.status, 200)
  assert.equal((await onboarded.json() as Account).role, 'customer')
  assert.deepEqual(calls.at(-1), { name: 'hostProfile', args: { name: host.name, bio: host.bio }, token: 'customer' })
  assert.equal((await request('/api/host/bikes', 'GET', undefined, rider)).status, 200)
  assert.deepEqual(calls.at(-1), { name: 'fleet', args: { scope: 'host' }, token: 'customer' })
  assert.equal((await request('/api/admin/bikes', 'GET', undefined, rider)).status, 403)

  const pickup = today()
  const rental = { city: 'Goa', pickup, returnDate: addDays(pickup, 3) }
  assert.equal((await request('/api/bikes?' + new URLSearchParams(rental))).status, 200)
  assert.deepEqual(calls.at(-1), { name: 'catalog', args: rental, token: undefined })

  const booking = { ...rental, bikeId: 'classic-350', riderName: 'Rider', phone: '9876543210', dailyRate: 899, agreement: true, requestKey: randomUUID() }
  assert.equal((await request('/api/bookings', 'POST', booking, admin)).status, 403)
  assert.equal((await request('/api/bookings', 'POST', { ...booking, phone: 'invalid' }, rider)).status, 400)
  const placed = await request('/api/bookings', 'POST', { ...booking, riderEmail: 'someone-else@example.test', role: 'admin' }, rider)
  assert.equal(placed.status, 201)
  assert.deepEqual(calls.at(-1), { name: 'book', args: booking, token: 'customer' })

  assert.equal((await request('/api/notifications')).status, 401)
  assert.equal((await request('/api/notifications', 'GET', undefined, rider)).status, 200)
  assert.deepEqual(calls.at(-1), { name: 'notifications', args: {}, token: 'customer' })
  const notificationId = randomUUID()
  assert.equal((await request(`/api/notifications/${notificationId}/read`, 'PATCH', undefined, rider)).status, 200)
  assert.deepEqual(calls.at(-1), { name: 'readNotifications', args: { id: notificationId }, token: 'customer' })
  assert.equal((await request('/api/notifications/read', 'PATCH', undefined, rider)).status, 200)
  assert.deepEqual(calls.at(-1), { name: 'readNotifications', args: {}, token: 'customer' })
  assert.equal((await request('/api/bikes/classic-350/reviews?page=0')).status, 400)
  assert.equal((await request('/api/bikes/classic-350/reviews?page=2')).status, 200)
  assert.deepEqual(calls.at(-1), { name: 'bikeReviews', args: { id: 'classic-350', page: 2 }, token: undefined })
  const review = { rating: 5, body: 'A good ride and easy pickup.' }
  assert.equal((await request('/api/bookings/RD-TEST/review', 'POST', review, admin)).status, 403)
  assert.equal((await request('/api/bookings/RD-TEST/review', 'POST', { ...review, rating: 6 }, rider)).status, 400)
  assert.equal((await request('/api/bookings/RD-TEST/review', 'POST', { ...review, id: 'other-booking' }, rider)).status, 201)
  assert.deepEqual(calls.at(-1), { name: 'reviewBooking', args: { ...review, id: 'RD-TEST' }, token: 'customer' })

  const refreshed = await request('/api/session', 'GET', undefined, 'rideon_refresh=refresh-customer')
  assert.equal((await refreshed.json() as Account).role, 'customer')
  assert.match(cookies(refreshed), /rideon_access=customer/)
  await request('/api/auth/sign-out', 'POST', undefined, rider)
  assert.deepEqual(ended, ['customer'])
})
