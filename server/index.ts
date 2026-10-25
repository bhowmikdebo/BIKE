import { createApp } from './app.ts'
import { openDatabase } from './db.ts'

const port = Number(process.env.RIDEON_PORT || 4173)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RIDEON_PORT must be a valid TCP port.')

const db = openDatabase()
const origin = process.env.RIDEON_ORIGIN ? new URL(process.env.RIDEON_ORIGIN).origin : ''
const server = createApp(db, { origin })
server.listen(port, '127.0.0.1', () => console.log(`RIDEON server http://127.0.0.1:${port}`))
server.on('error', error => { console.error(error.message); db.close(); process.exitCode = 1 })
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => db.close()))
}
