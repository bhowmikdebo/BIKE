import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import type { Session } from '@supabase/supabase-js'
import type { Account } from '../../shared/types.ts'
import { addDays, today } from '../../shared/rental.ts'
import { createApp } from './app.ts'
import { HttpError } from './http.ts'
import type { SupabaseGateway } from './supabase.ts'

function testSession(kind: Account['role']): Session {
  return {
    access_token: kind, refresh_token: 'refresh-' + kind, expires_in: 3600, token_type: 'bearer',
    user: { id: kind, aud: 'authenticated', created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} },
  }
}

test('Express forwards validated requests with the current rider identity and protects admin routes', async t => {
  const calls: { name: string; args?: Record<string, unknown>; token?: string }[] = []
  const ended: string[] = []
  const host = { name: 'Rider Garage', slug: 'rider-garage', bio: '' }
  let hostEnabled = false
  const gateway: SupabaseGateway = {
    signIn: async email => testSession(email.startsWith('admin') ? 'admin' : 'customer'),
    register: async () => null,
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
  const server = createApp(gateway).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const request = (path: string, method = 'GET', body?: unknown, cookie = '', headers: Record<string, string> = {}) =>
    fetch(url + path, { method, headers: { cookie, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const cookies = (response: Response) => response.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')

  assert.equal((await request('/api/admin/bikes')).status, 401)
  assert.equal((await request('/api/auth/sign-in', 'POST', {}, '', { Origin: 'https://unrelated.example' })).status, 403)
  const registered = await request('/api/auth/register', 'POST', { name: 'Rider', email: 'rider@example.test', password: 'temporary-test-password' })
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

  const refreshed = await request('/api/session', 'GET', undefined, 'rideon_refresh=refresh-customer')
  assert.equal((await refreshed.json() as Account).role, 'customer')
  assert.match(cookies(refreshed), /rideon_access=customer/)
  await request('/api/auth/sign-out', 'POST', undefined, rider)
  assert.deepEqual(ended, ['customer'])
})
