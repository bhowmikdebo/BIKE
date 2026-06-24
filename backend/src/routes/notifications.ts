import { Router } from 'express'
import type { SessionManager } from '../auth/session.ts'
import { resourceId } from '../http.ts'
import type { SupabaseGateway } from '../supabase.ts'

export function notificationRoutes(gateway: SupabaseGateway, sessions: SessionManager) {
  const router = Router()

  router.get('/notifications', async (request, response) => {
    const { token } = await sessions.requireAccount(request, response)
    response.json(await gateway.rpc('notifications', {}, token))
  })
  router.patch(['/notifications/read', '/notifications/:id/read'], async (request, response) => {
    const { token } = await sessions.requireAccount(request, response)
    const args = request.params.id === undefined ? {} : { id: resourceId(request) }
    response.json(await gateway.rpc('readNotifications', args, token))
  })

  return router
}
