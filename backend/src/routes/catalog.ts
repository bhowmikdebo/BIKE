import { Router } from 'express'
import { resourceId } from '../http.ts'
import type { SupabaseGateway } from '../supabase.ts'
import { rental, reviewPage } from '../validation.ts'
import { sendBikeImage } from './bike-image.ts'

export function catalogRoutes(gateway: SupabaseGateway) {
  const router = Router()

  router.get('/bikes', async (request, response) => {
    response.json(await gateway.rpc('catalog', { ...rental(request.query, false) }))
  })
  router.get('/reviews', async (_request, response) => {
    response.json(await gateway.rpc('recentReviews'))
  })
  router.get('/bikes/:id/reviews', async (request, response) => {
    response.json(await gateway.rpc('bikeReviews', { id: resourceId(request), page: reviewPage(request.query.page) }))
  })
  router.get('/bikes/:id/availability', async (request, response) => {
    response.json(await gateway.rpc('quote', { ...rental(request.query, true), bikeId: resourceId(request) }))
  })
  router.get('/bikes/:id/image', async (request, response) => {
    await sendBikeImage(gateway, response, { bikeId: resourceId(request) })
  })
  router.get('/hosts/:slug', async (request, response) => {
    response.json(await gateway.rpc('storefront', { slug: resourceId(request, 'slug') }))
  })

  return router
}
