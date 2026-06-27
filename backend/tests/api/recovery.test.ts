import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createApp } from '../../src/app.ts'
import { listen, testSession } from './fixtures.ts'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { createSupabaseGateway } from '../../src/supabase.ts'

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
  const providerUrl = await listen(t, createServer(async (request, response) => {
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
  }))
  const base = await listen(t, createServer(createApp(createSupabaseGateway({ url: providerUrl, key: 'test-provider-key' }))))
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
