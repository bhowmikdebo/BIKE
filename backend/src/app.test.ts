import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import type { Session } from '@supabase/supabase-js'
import type { Account } from '../../shared/types.ts'
import { addDays, today } from '../../shared/rental.ts'
import { createApp } from './app.ts'
import { HttpError } from './http.ts'
import { createSupabaseGateway } from './supabase.ts'
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
  const server = createApp(gateway).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
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

  const refreshed = await request('/api/session', 'GET', undefined, 'rideon_refresh=refresh-customer')
  assert.equal((await refreshed.json() as Account).role, 'customer')
  assert.match(cookies(refreshed), /rideon_access=customer/)
  await request('/api/auth/sign-out', 'POST', undefined, rider)
  assert.deepEqual(ended, ['customer'])
})

test('password recovery exchanges the SDK challenge and keeps the session separate from sign-in', async t => {
  const user = { ...testSession('customer').user, id: randomUUID(), email: 'test@example.test' }
  const jwtPart = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const claims = `${jwtPart({ alg: 'HS256' })}.${jwtPart({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}`
  const access = `${claims}.${createHmac('sha256', 'test-secret').update(claims).digest('base64url')}`
  const refresh = 'test-recovery-refresh'
  const providerSession = { ...testSession('customer'), access_token: access, refresh_token: refresh, user }
  const requestedPassword = 'new-temporary-password'
  let challenge = ''
  let redirect = ''
  let changedPassword = false
  let signedOut = false
  const auth = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const parts: Buffer[] = []
    for await (const chunk of request) parts.push(chunk)
    const body = parts.length ? JSON.parse(Buffer.concat(parts).toString()) : {}
    const json = (value: unknown, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value))
    }
    if (url.pathname === '/auth/v1/recover') {
      assert.equal(body.email, user.email)
      challenge = body.code_challenge
      redirect = url.searchParams.get('redirect_to') ?? ''
      assert.equal(body.code_challenge_method, 's256')
      return json({})
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const verified = body.auth_code === 'valid-test-code' &&
        createHash('sha256').update(body.code_verifier).digest('base64url') === challenge
      return verified ? json(providerSession) : json({ code: 'bad_code_verifier', msg: 'Invalid verifier' }, 400)
    }
    if (request.headers.authorization === `Bearer ${access}`) {
      if (url.pathname === '/auth/v1/user' && request.method === 'GET') return json(user)
      if (url.pathname === '/auth/v1/user' && request.method === 'PUT') {
        changedPassword = body.password === requestedPassword
        return json(user)
      }
      if (url.pathname === '/auth/v1/logout') {
        signedOut = true
        response.writeHead(204).end()
        return
      }
    }
    return json({ code: 'unexpected_request', msg: 'Unexpected request' }, 400)
  }).listen(0, '127.0.0.1')
  await once(auth, 'listening')
  t.after(() => new Promise<void>(resolve => auth.close(() => resolve())))
  const providerUrl = `http://127.0.0.1:${(auth.address() as AddressInfo).port}`
  const app = createApp(createSupabaseGateway({ url: providerUrl, key: 'test-provider-key' })).listen(0, '127.0.0.1')
  await once(app, 'listening')
  t.after(() => new Promise<void>(resolve => app.close(() => resolve())))
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`
  const post = (path: string, body: unknown, cookie = '') => fetch(base + path, {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', cookie },
  })
  const cookiePairs = (response: Response) => response.headers.getSetCookie()
    .filter(cookie => !cookie.includes('Expires=Thu, 01 Jan 1970')).map(cookie => cookie.split(';')[0]).join('; ')
  const password = { password: requestedPassword, confirmPassword: requestedPassword }
  assert.equal((await post('/api/auth/recovery/password', password)).status, 401)

  const email = await post('/api/auth/forgot-password', { email: user.email })
  assert.equal(email.status, 202)
  assert.equal(redirect, base + '/api/auth/recovery/callback')
  const verifier = cookiePairs(email)
  assert.match(verifier, /^rideon_reset_verifier=/)

  const url = redirect + '?code=valid-test-code'
  const wrongBrowser = await fetch(url, { redirect: 'manual' })
  assert.equal(wrongBrowser.status, 303)
  assert.equal(wrongBrowser.headers.getSetCookie().length, 0)
  const opened = await fetch(url, { redirect: 'manual', headers: { cookie: verifier } })
  assert.equal(opened.status, 303)
  assert.equal(opened.headers.get('location'), '/reset-password')
  const recovery = cookiePairs(opened)
  assert.match(recovery, /rideon_reset_access=/)
  assert.match(recovery, /rideon_reset_refresh=/)
  assert.equal(await (await fetch(base + '/api/session', { headers: { cookie: recovery } })).json(), null)
  assert.deepEqual(await (await fetch(base + '/api/auth/recovery/session', { headers: { cookie: recovery } })).json(), { ready: true })

  const mismatch = await post('/api/auth/recovery/password', { ...password, confirmPassword: 'another-long-password' }, recovery)
  assert.equal(mismatch.status, 400)
  assert.equal(changedPassword, false)
  const updated = await post('/api/auth/recovery/password', password, recovery)
  assert.equal(updated.status, 200, await updated.text())
  assert.equal(changedPassword, true)
  assert.equal(signedOut, true)
})
