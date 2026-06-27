import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createApp } from '../../src/app.ts'
import { listen, testSession } from './fixtures.ts'
import { createHash } from 'node:crypto'
import { createSupabaseGateway } from '../../src/supabase.ts'

test('email and Google use the configured public callback and establish sessions through PKCE', async t => {
  const publicOrigin = 'https://rideon.example.test'
  const providerSession = testSession('customer')
  const account = { id: 'customer', name: 'Test Rider', email: 'rider@example.test', role: 'customer' }
  let googleEnabled = false
  const challenges = new Map<string, string>()
  const providerUrl = await listen(t, createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
    const json = (value: unknown, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value))
    }
    if (url.pathname === '/auth/v1/settings') return json({ external: { google: googleEnabled } })
    if (url.pathname === '/auth/v1/signup') {
      assert.equal(url.searchParams.get('redirect_to'), publicOrigin + '/api/auth/email/callback')
      assert.equal(body.code_challenge_method, 's256')
      assert.equal(body.email, account.email)
      challenges.set('email-code', body.code_challenge)
      return json({ user: providerSession.user })
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const valid = createHash('sha256').update(body.code_verifier).digest('base64url') === challenges.get(body.auth_code)
      return valid ? json(providerSession) : json({ code: 'bad_code_verifier', msg: 'Invalid verifier' }, 400)
    }
    if (url.pathname === '/rest/v1/rpc/rideon_api' && request.headers.authorization === 'Bearer customer') {
      assert.equal(body.operation, 'account')
      return json(account)
    }
    return json({ msg: 'Unexpected request' }, 400)
  }))
  const gateway = createSupabaseGateway({ url: providerUrl, key: 'test-provider-key' })
  const base = await listen(t, createServer(createApp(gateway, { origin: publicOrigin })))
  const post = (path: string, body: unknown) => fetch(base + path, {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: publicOrigin },
  })
  const open = (path: string, cookie = '') => fetch(base + path, { redirect: 'manual', headers: { cookie } })
  const pendingCookie = (response: Response) => {
    const cookies = response.headers.getSetCookie()
    assert.equal(cookies.length, 1)
    assert.match(cookies[0], /HttpOnly; Secure; SameSite=Lax/)
    return cookies[0].split(';')[0]
  }

  const password = 'test-password-with-length'
  const registered = await post('/api/auth/register', { name: account.name, email: account.email, password, confirmPassword: password, next: '/host' })
  assert.equal(registered.status, 201)
  assert.equal(await registered.json(), null)
  const emailPending = pendingCookie(registered)
  const confirmationPath = '/api/auth/email/callback?code=email-code'
  const otherBrowser = await open(confirmationPath)
  assert.equal(otherBrowser.headers.get('location'), '/sign-in?auth=confirmed')
  assert(!otherBrowser.headers.getSetCookie().some(cookie => cookie.startsWith('rideon_access=')))
  const confirmed = await open(confirmationPath, emailPending)
  assert.equal(confirmed.headers.get('location'), '/sign-in?next=%2Fhost&auth=confirmed')
  assert(confirmed.headers.getSetCookie().some(cookie => cookie.startsWith('rideon_access=customer;')))
  assert.equal((await open('/api/auth/email/callback?error_code=otp_expired')).headers.get('location'), '/sign-in?auth=email-link')

  assert.equal((await post('/api/auth/google/start', {})).status, 503)
  googleEnabled = true
  const booking = '/booking/test-bike?city=Goa'
  const started = await post('/api/auth/google/start', { next: booking })
  assert.equal(started.status, 200)
  const authorization = new URL((await started.json() as { url: string }).url)
  assert.equal(authorization.origin, providerUrl)
  assert.equal(authorization.pathname, '/auth/v1/authorize')
  assert.equal(authorization.searchParams.get('provider'), 'google')
  assert.equal(authorization.searchParams.get('redirect_to'), publicOrigin + '/api/auth/google/callback')
  assert.equal(authorization.searchParams.get('code_challenge_method'), 's256')
  challenges.set('google-code', authorization.searchParams.get('code_challenge') ?? '')
  const googlePending = pendingCookie(started)
  const googlePath = '/api/auth/google/callback?code=google-code'
  assert.equal((await open(googlePath)).headers.get('location'), '/sign-in?auth=google-failed')
  const google = await open(googlePath, googlePending)
  assert.equal(google.headers.get('location'), '/sign-in?next=' + encodeURIComponent(booking))
  assert(google.headers.getSetCookie().some(cookie => cookie.startsWith('rideon_access=customer;')))
  const externalNext = pendingCookie(await post('/api/auth/google/start', { next: '//elsewhere.example' }))
  assert.equal((await open('/api/auth/google/callback?error=access_denied', externalNext)).headers.get('location'), '/sign-in?auth=google-cancelled')
})
