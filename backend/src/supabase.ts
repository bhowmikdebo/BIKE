import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

interface Config { url: string; key: string; emailRedirect?: string }

export interface SupabaseGateway {
  rpc<T>(name: string, args?: Record<string, unknown>, accessToken?: string): Promise<T>
}

export function createSupabaseGateway(config: Config): SupabaseGateway {
  const options = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  const client = () => createClient(config.url, config.key, { auth: options })

  return {
    async rpc<T>(name: string, args = {}, accessToken?: string) {
      const db = accessToken
        ? createClient(config.url, config.key, { accessToken: async () => accessToken })
        : client()
      const { data, error, status } = await db.rpc('rideon_api', { operation: name, payload: args })
      if (error) {
        if (/^PT4\d{2}$/.test(error.code)) throw new HttpError(Number(error.code.slice(2)), error.message)
        if (status === 401) throw new HttpError(401, 'Sign in to continue.')
        if (error.code === '42501') throw new HttpError(403, 'Your account cannot access this operation.')
        if (error.code === '23P01' || error.code === '23505') throw new HttpError(409, 'This request conflicts with an existing record.')
        console.error('Supabase RPC failure:', name, error.code)
        throw new HttpError(503, 'The RIDEON database is temporarily unavailable.')
      }
      return data as T
    },
  }
}
