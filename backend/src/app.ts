import express from 'express'
import type { ErrorRequestHandler, Request, Response } from 'express'
import { isIP } from 'node:net'
import { extname, resolve } from 'node:path'
import { createSessionManager } from './auth.ts'
import { mountAccountEntry } from './auth-entry.ts'
import { checkOrigin, HttpError } from './http.ts'
import { mountPasswordRecovery } from './recovery.ts'
import type { SupabaseGateway } from './supabase.ts'
import { accountEmail, bikeInput, blockedDates, bookingInput, hostProfile, object, password, rental, uploadedImage } from './validation.ts'

function resourceId(request: Request, parameter = 'id') {
  const id = request.params[parameter]
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,90}$/i.test(id)) throw new HttpError(404, 'Bike or booking not found.')
  return id
}

function saveInput(body: unknown) {
  const input = bikeInput(body)
  const { image, ...bike } = input
  if (typeof image !== 'string') return { ...bike, ...(image === null ? { image: null } : {}) }
  const file = uploadedImage(image)
  return { ...bike, image: { mime: file.mime, data: file.data.toString('base64') } }
}

export function createApp(gateway: SupabaseGateway, { origin = '', frontendDir = '', vercel = false } = {}) {
  const app = express()
  const router = express.Router()
  const sessions = createSessionManager(gateway, origin.startsWith('https://'))
  const attempts = new Map<string, { count: number; until: number }>()
  const smallJson = express.json({ limit: '32kb' })
  const fleetJson = express.json({ limit: '3mb' })

  app.disable('x-powered-by')
  app.use((_request, response, next) => {
    response.set('X-Content-Type-Options', 'nosniff')
    response.set('Referrer-Policy', 'same-origin')
    next()
  })
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store')
    if (!['GET', 'HEAD'].includes(request.method)) checkOrigin(request, origin)
    next()
  })

  function limitAuthentication(request: Request) {
    const edgeIp = vercel ? request.get('x-vercel-forwarded-for') : undefined
    const ip = edgeIp && isIP(edgeIp) ? edgeIp : request.socket.remoteAddress || 'unknown'
    const now = Date.now()
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key)
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 600_000 }
    if (++attempt.count > 30) throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.')
    attempts.set(ip, attempt)
  }

  router.get('/session', async (request, response) => {
    response.json((await sessions.current(request, response))?.account ?? null)
  })
  router.post('/auth/sign-in', smallJson, async (request, response) => {
    limitAuthentication(request)
    const raw = object(request.body)
    const session = await gateway.signIn(accountEmail(raw.email), password(raw.password))
    response.json(await sessions.start(response, session))
  })
  router.post('/auth/sign-out', async (request, response) => {
    await sessions.end(request, response)
    response.json(null)
  })

  mountAccountEntry(router, gateway, { origin, parseJson: smallJson, limit: limitAuthentication, sessions })
  mountPasswordRecovery(router, gateway, { origin, parseJson: smallJson, limit: limitAuthentication, clearSession: sessions.clear })

  router.get('/bikes', async (request, response) => {
    response.json(await gateway.rpc('catalog', { ...rental(request.query, false) }))
  })
  router.get('/bikes/:id/availability', async (request, response) => {
    response.json(await gateway.rpc('quote', { ...rental(request.query, true), bikeId: resourceId(request) }))
  })
  async function sendBikeImage(response: Response, payload: Record<string, unknown>, token?: string) {
    const photo = await gateway.rpc<{ mime: string; data: string }>('image', payload, token)
    response.type(photo.mime).set('Cache-Control', 'no-cache').send(Buffer.from(photo.data, 'base64'))
  }

  router.get('/bikes/:id/image', async (request, response) => {
    await sendBikeImage(response, { bikeId: resourceId(request) })
  })
  router.get('/hosts/:slug', async (request, response) => {
    response.json(await gateway.rpc('storefront', { slug: resourceId(request, 'slug') }))
  })
  router.get('/bookings', async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.json(await gateway.rpc('bookings', {}, token))
  })
  router.post('/bookings', smallJson, async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.status(201).json(await gateway.rpc('book', { ...bookingInput(request.body) }, token))
  })
  router.patch('/bookings/:id/status', smallJson, async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.json(await gateway.rpc('status', { id: resourceId(request), status: object(request.body).status, scope: 'rider' }, token))
  })

  router.put('/host/profile', smallJson, async (request, response) => {
    const { token } = await sessions.requireAccount(request, response)
    response.json(await gateway.rpc('hostProfile', hostProfile(request.body), token))
  })

  async function operator(request: Request, response: Response, scope: 'admin' | 'host') {
    if (scope === 'admin') return (await sessions.requireRole(request, response, 'admin')).token
    const user = await sessions.requireAccount(request, response)
    if (!user.account.host) throw new HttpError(403, 'Set up your host profile first.')
    return user.token
  }

  for (const scope of ['admin', 'host'] as const) {
    const bikes = `/${scope}/bikes`
    const bookings = `/${scope}/bookings`
    router.get(bikes, async (request, response) => {
      response.json(await gateway.rpc('fleet', { scope }, await operator(request, response, scope)))
    })
    router.post(bikes, fleetJson, async (request, response) => {
      const token = await operator(request, response, scope)
      response.status(201).json(await gateway.rpc('saveBike', { scope, data: saveInput(request.body) }, token))
    })
    router.put(bikes + '/:id', fleetJson, async (request, response) => {
      const token = await operator(request, response, scope)
      response.json(await gateway.rpc('saveBike', { scope, id: resourceId(request), data: saveInput(request.body) }, token))
    })
    router.patch(bikes + '/:id/publication', smallJson, async (request, response) => {
      const token = await operator(request, response, scope)
      const { active } = object(request.body)
      if (typeof active !== 'boolean') throw new HttpError(400, 'Select a publication status.')
      response.json(await gateway.rpc('publish', { scope, id: resourceId(request), active }, token))
    })
    router.get(bikes + '/:id/image', async (request, response) => {
      await sendBikeImage(response, { scope, bikeId: resourceId(request) }, await operator(request, response, scope))
    })
    router.get(bookings, async (request, response) => {
      response.json(await gateway.rpc('bookings', { scope }, await operator(request, response, scope)))
    })
    router.patch(bookings + '/:id/status', smallJson, async (request, response) => {
      const token = await operator(request, response, scope)
      response.json(await gateway.rpc('status', { scope, id: resourceId(request), status: object(request.body).status }, token))
    })
  }

  router.get('/host/bikes/:id/blocks', async (request, response) => {
    response.json(await gateway.rpc('blocks', { bikeId: resourceId(request) }, await operator(request, response, 'host')))
  })
  router.post('/host/bikes/:id/blocks', smallJson, async (request, response) => {
    const token = await operator(request, response, 'host')
    response.status(201).json(await gateway.rpc('block', { bikeId: resourceId(request), ...blockedDates(request.body) }, token))
  })
  router.delete('/host/bikes/:id/blocks/:blockId', async (request, response) => {
    const token = await operator(request, response, 'host')
    response.json(await gateway.rpc('unblock', { bikeId: resourceId(request), blockId: resourceId(request, 'blockId') }, token))
  })

  router.use((_request, _response) => { throw new HttpError(404, 'API route not found.') })
  app.use('/api', router)

  if (frontendDir) {
    app.use(express.static(frontendDir, { setHeaders: (response, path) => {
      if (extname(path) === '.html') response.setHeader('Content-Security-Policy',
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
    } }))
    app.get(/.*/, (request, response, next) => {
      if (extname(request.path)) return next(new HttpError(404, 'File not found.'))
      response.set('Content-Security-Policy',
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
      response.sendFile(resolve(frontendDir, 'index.html'), error => {
        if (error) next(new HttpError(503, 'Build the frontend before opening the website.'))
      })
    })
  }

  const errors: ErrorRequestHandler = (error, _request, response, next) => {
    if (response.headersSent) return next(error)
    if (error instanceof HttpError) response.status(error.status).json({ error: error.message })
    else if (error?.type === 'entity.too.large') response.status(413).json({ error: 'This upload is too large.' })
    else if (error?.type === 'entity.parse.failed') response.status(400).json({ error: 'Invalid JSON request.' })
    else {
      console.error(error)
      response.status(500).json({ error: 'The server could not complete this request.' })
    }
  }
  app.use(errors)
  return app
}
