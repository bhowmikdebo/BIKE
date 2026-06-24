import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SessionManager } from '../auth/session.ts'
import { resourceId } from '../http.ts'
import type { SupabaseGateway } from '../supabase.ts'
import { bookingInput, object, reviewInput } from '../validation.ts'

export function bookingRoutes(gateway: SupabaseGateway, sessions: SessionManager, parseJson: RequestHandler) {
  const router = Router()

  router.get('/bookings', async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.json(await gateway.rpc('bookings', {}, token))
  })
  router.post('/bookings', parseJson, async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.status(201).json(await gateway.rpc('book', { ...bookingInput(request.body) }, token))
  })
  router.patch('/bookings/:id/status', parseJson, async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.json(await gateway.rpc('status', { id: resourceId(request), status: object(request.body).status, scope: 'rider' }, token))
  })
  router.post('/bookings/:id/review', parseJson, async (request, response) => {
    const { token } = await sessions.requireRole(request, response, 'customer')
    response.status(201).json(await gateway.rpc('reviewBooking', { id: resourceId(request), ...reviewInput(request.body) }, token))
  })

  return router
}
