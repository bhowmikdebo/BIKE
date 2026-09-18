import express from 'express'
import type { ErrorRequestHandler } from 'express'
import { checkOrigin, HttpError } from './http.ts'
import type { SupabaseGateway } from './supabase.ts'


export function createApp(_gateway: SupabaseGateway, { origin = '' } = {}) {
  const app = express()
  const router = express.Router()

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
