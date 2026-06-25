import { Router } from 'express'
import type { Request, RequestHandler, Response } from 'express'
import type { OperatorScope } from '../../../shared/types.ts'
import type { SessionManager } from '../auth/session.ts'
import { HttpError, resourceId } from '../http.ts'
import type { SupabaseGateway } from '../supabase.ts'
import { bikeInput, blockedDates, hostProfile, object, uploadedImage } from '../validation.ts'
import { sendBikeImage } from './bike-image.ts'

function saveInput(body: unknown) {
  const input = bikeInput(body)
  const { image, ...bike } = input
  if (typeof image !== 'string') return { ...bike, ...(image === null ? { image: null } : {}) }
  const file = uploadedImage(image)
  return { ...bike, image: { mime: file.mime, data: file.data.toString('base64') } }
}

export function operationRoutes(
  gateway: SupabaseGateway,
  sessions: SessionManager,
  parseJson: RequestHandler,
  parseFleetJson: RequestHandler,
) {
  const router = Router()

  router.put('/host/profile', parseJson, async (request, response) => {
    const { token } = await sessions.requireAccount(request, response)
    response.json(await gateway.rpc('hostProfile', hostProfile(request.body), token))
  })

  async function operator(request: Request, response: Response, scope: OperatorScope) {
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
    router.post(bikes, parseFleetJson, async (request, response) => {
      const token = await operator(request, response, scope)
      response.status(201).json(await gateway.rpc('saveBike', { scope, data: saveInput(request.body) }, token))
    })
    router.put(bikes + '/:id', parseFleetJson, async (request, response) => {
      const token = await operator(request, response, scope)
      response.json(await gateway.rpc('saveBike', { scope, id: resourceId(request), data: saveInput(request.body) }, token))
    })
    router.patch(bikes + '/:id/publication', parseJson, async (request, response) => {
      const token = await operator(request, response, scope)
      const { active } = object(request.body)
      if (typeof active !== 'boolean') throw new HttpError(400, 'Select a publication status.')
      response.json(await gateway.rpc('publish', { scope, id: resourceId(request), active }, token))
    })
    router.get(bikes + '/:id/image', async (request, response) => {
      await sendBikeImage(gateway, response, { scope, bikeId: resourceId(request) }, await operator(request, response, scope))
    })
    router.get(bookings, async (request, response) => {
      response.json(await gateway.rpc('bookings', { scope }, await operator(request, response, scope)))
    })
    router.patch(bookings + '/:id/status', parseJson, async (request, response) => {
      const token = await operator(request, response, scope)
      response.json(await gateway.rpc('status', { scope, id: resourceId(request), status: object(request.body).status }, token))
    })
  }

  router.get('/host/bikes/:id/blocks', async (request, response) => {
    response.json(await gateway.rpc('blocks', { bikeId: resourceId(request) }, await operator(request, response, 'host')))
  })
  router.post('/host/bikes/:id/blocks', parseJson, async (request, response) => {
    const token = await operator(request, response, 'host')
    response.status(201).json(await gateway.rpc('block', { bikeId: resourceId(request), ...blockedDates(request.body) }, token))
  })
  router.delete('/host/bikes/:id/blocks/:blockId', async (request, response) => {
    const token = await operator(request, response, 'host')
    response.json(await gateway.rpc('unblock', { bikeId: resourceId(request), blockId: resourceId(request, 'blockId') }, token))
  })

  return router
}
