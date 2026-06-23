import type { Response } from 'express'
import type { OperatorScope } from '../../../shared/types.ts'
import type { SupabaseGateway } from '../supabase.ts'

export async function sendBikeImage(
  gateway: SupabaseGateway,
  response: Response,
  payload: { bikeId: string; scope?: OperatorScope },
  token?: string,
) {
  const photo = await gateway.rpc<{ mime: string; data: string }>('image', payload, token)
  response.type(photo.mime).set('Cache-Control', 'no-cache').send(Buffer.from(photo.data, 'base64'))
}
