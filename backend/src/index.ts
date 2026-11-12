import { fileURLToPath } from 'node:url'
import { configuredApp } from './configured-app.ts'

const port = Number(process.env.RIDEON_PORT || 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RIDEON_PORT must be a valid TCP port.')
const frontendDir = fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
const server = configuredApp(frontendDir).listen(port, '127.0.0.1', () => {
  console.log(`RIDEON Express API http://127.0.0.1:${port}`)
})
server.requestTimeout = 30_000
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close())
