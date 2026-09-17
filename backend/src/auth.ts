import type { Session } from '@supabase/supabase-js'
import type { Request, Response } from 'express'
import type { Account } from '../../shared/types.ts'
import { HttpError } from './http.ts'
import type { SupabaseGateway } from './supabase.ts'

const accessCookie = 'rideon_access'
const refreshCookie = 'rideon_refresh'
const cookieSettings = { httpOnly: true, sameSite: 'lax', path: '/api' } as const

function readCookie(request: Request, name: string) {
  const raw = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1)
  if (!raw || raw.length > 4096) return undefined
  try { return decodeURIComponent(raw) } catch { return undefined }
}

export function createSessionManager(gateway: SupabaseGateway, secure: boolean) {
  function clear(response: Response) {
    response.clearCookie(accessCookie, { ...cookieSettings, secure })
    response.clearCookie(refreshCookie, { ...cookieSettings, secure })
  }

  function write(response: Response, session: Session) {
    response.cookie(accessCookie, session.access_token, { ...cookieSettings, secure, maxAge: session.expires_in * 1000 })
    response.cookie(refreshCookie, session.refresh_token, { ...cookieSettings, secure, maxAge: 7 * 86_400_000 })
  }
  async function current(request: Request, response: Response) {
    const access = readCookie(request, accessCookie)
    if (access) {
      try {
        return { account: await gateway.rpc<Account>('account', {}, access), token: access }
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) throw error
      }
    }
    if (access) clear(response)
    return null
  }

  return {
    current,
    async start(response: Response, session: Session) {
      const account = await gateway.rpc<Account>('account', {}, session.access_token)
      write(response, session)
      return account
    },
  }
}
