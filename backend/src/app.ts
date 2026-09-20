import express from 'express'
import type { ErrorRequestHandler, Request, Response } from 'express'
import { createSessionManager } from './auth.ts'
import { checkOrigin, HttpError } from './http.ts'
import type { SupabaseGateway } from './supabase.ts'
import { accountEmail, accountName, bikeInput, bookingInput, object, password, rental, uploadedImage } from './validation.ts'

function bikeId(request: Request) {
  const id = request.params.id
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

export function createApp(gateway: SupabaseGateway, { origin = '' } = {}) {
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
    const ip = request.socket.remoteAddress || 'unknown'
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
  router.post('/auth/register', smallJson, async (request, response) => {
    limitAuthentication(request)
    const raw = object(request.body)
    const session = await gateway.register(accountName(raw.name), accountEmail(raw.email), password(raw.password, true))
    response.status(201).json(session ? await sessions.start(response, session) : null)
  })
  router.post('/auth/sign-out', async (request, response) => {
    await sessions.end(request, response)
    response.json(null)
  })
  router.get('/bikes', async (request, response) => {
    response.json(await gateway.rpc('catalog', { ...rental(request.query, false) }))
  })
  router.get('/bikes/:id/availability', async (request, response) => {
    response.json(await gateway.rpc('quote', { ...rental(request.query, true), bikeId: bikeId(request) }))
  })
  router.get('/bikes/:id/image', async (request, response) => {
    const photo = await gateway.rpc<{ mime: string; data: string }>('image', { bikeId: bikeId(request) })
    response.type(photo.mime).set('Cache-Control', 'no-cache').send(Buffer.from(photo.data, 'base64'))
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
    response.json(await gateway.rpc('status', { id: bikeId(request), status: object(request.body).status }, token))
  })
  async function admin(request: Request, response: Response) {
    return (await sessions.requireRole(request, response, 'admin')).token
  }
  router.get('/admin/bikes', async (request, response) => {
    response.json(await gateway.rpc('fleet', {}, await admin(request, response)))
  })
  router.post('/admin/bikes', fleetJson, async (request, response) => {
    const token = await admin(request, response)
    response.status(201).json(await gateway.rpc('saveBike', { data: saveInput(request.body) }, token))
  })
  router.put('/admin/bikes/:id', fleetJson, async (request, response) => {
    const token = await admin(request, response)
    response.json(await gateway.rpc('saveBike', { id: bikeId(request), data: saveInput(request.body) }, token))
  })

  router.use((_request, _response) => { throw new HttpError(404, 'API route not found.') })
  app.use('/api', router)

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
