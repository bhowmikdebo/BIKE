import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { extname, resolve } from 'node:path'
import { mountAccountEntry } from './auth/entry.ts'
import { createAuthRateLimit } from './auth/rate-limit.ts'
import { mountPasswordRecovery } from './auth/recovery.ts'
import { createSessionManager } from './auth/session.ts'
import { checkOrigin, HttpError } from './http.ts'
import { bookingRoutes } from './routes/bookings.ts'
import { catalogRoutes } from './routes/catalog.ts'
import { notificationRoutes } from './routes/notifications.ts'
import { operationRoutes } from './routes/operations.ts'
import type { SupabaseGateway } from './supabase.ts'

const pagePolicy = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

const handleError: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error)
  if (error instanceof HttpError) response.status(error.status).json({ error: error.message })
  else if (error?.type === 'entity.too.large') response.status(413).json({ error: 'This upload is too large.' })
  else if (error?.type === 'entity.parse.failed') response.status(400).json({ error: 'Invalid JSON request.' })
  else {
    console.error(error)
    response.status(500).json({ error: 'The server could not complete this request.' })
  }
}

export function createApp(gateway: SupabaseGateway, { origin = '', frontendDir = '', vercel = false } = {}) {
  const app = express()
  const router = express.Router()
  const sessions = createSessionManager(gateway, origin.startsWith('https://'))
  const limit = createAuthRateLimit(vercel)
  const parseJson = express.json({ limit: '32kb' })
  const parseFleetJson = express.json({ limit: '3mb' })

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

  mountAccountEntry(router, gateway, { origin, parseJson, limit, sessions })
  mountPasswordRecovery(router, gateway, { origin, parseJson, limit, clearSession: sessions.clear })
  router.use(catalogRoutes(gateway))
  router.use(bookingRoutes(gateway, sessions, parseJson))
  router.use(notificationRoutes(gateway, sessions))
  router.use(operationRoutes(gateway, sessions, parseJson, parseFleetJson))
  router.use(() => { throw new HttpError(404, 'API route not found.') })
  app.use('/api', router)

  if (frontendDir) {
    app.use(express.static(frontendDir, { setHeaders: (response, path) => {
      if (extname(path) === '.html') response.setHeader('Content-Security-Policy', pagePolicy)
    } }))
    app.get(/.*/, (request, response, next) => {
      if (extname(request.path)) return next(new HttpError(404, 'File not found.'))
      response.set('Content-Security-Policy', pagePolicy)
      response.sendFile(resolve(frontendDir, 'index.html'), error => {
        if (error) next(new HttpError(503, 'Build the frontend before opening the website.'))
      })
    })
  }

  app.use(handleError)
  return app
}
