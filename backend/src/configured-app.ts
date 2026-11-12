import { createApp } from './app.ts'
import { createSupabaseGateway } from './supabase.ts'

export function configuredApp(frontendDir = '') {
  const env = process.env
  const originUrl = env.RIDEON_ORIGIN
  const origin = originUrl ? new URL(originUrl).origin : ''

  const url = env.SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env or in the environment.')
  if (!key.startsWith('sb_publishable_')) throw new Error('SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key.')
  const supabaseUrl = new URL(url)
  if (supabaseUrl.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname)) {
    throw new Error('Use an HTTPS URL for a hosted Supabase project.')
  }
  return createApp(createSupabaseGateway({ url, key }), { origin, frontendDir })
}
