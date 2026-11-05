import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { createSupabaseGateway } from './supabase.ts'

const port = Number(process.env.RIDEON_PORT || 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RIDEON_PORT must be a valid TCP port.')
const origin = process.env.RIDEON_ORIGIN ? new URL(process.env.RIDEON_ORIGIN).origin : ''
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env or in the environment.')
if (!key.startsWith('sb_publishable_')) throw new Error('SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key.')
if (new URL(url).protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('Use an HTTPS URL for a hosted Supabase project.')
}
const frontendDir = fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
const gateway = createSupabaseGateway({ url, key })
const server = createApp(gateway, { origin, frontendDir }).listen(port, '127.0.0.1', () => {
  console.log(`RIDEON Express API http://127.0.0.1:${port}`)
})
server.requestTimeout = 30_000
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close())
