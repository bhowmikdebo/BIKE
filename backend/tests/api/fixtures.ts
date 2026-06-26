import { once } from 'node:events'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { TestContext } from 'node:test'
import type { Session } from '@supabase/supabase-js'
import type { Account } from '../../../shared/types.ts'

export async function listen(t: TestContext, server: Server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

export function testSession(kind: Account['role']): Session {
  return {
    access_token: kind, refresh_token: 'refresh-' + kind, expires_in: 3600, token_type: 'bearer',
    user: { id: kind, aud: 'authenticated', created_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} },
  }
}
