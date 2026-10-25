import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { BookingStatus } from '../src/types.ts'
import { authenticate, createAccount, currentAccount, endSession, requireAccount, startSession } from './auth.ts'
import { bookBike, changeBooking, listBookings } from './bookings.ts'
import type { Db } from './db.ts'
import { bikeImage, listManagedBikes, listPublicBikes, quoteBike, saveBike, setBikeActive } from './fleet.ts'
import { checkOrigin, HttpError, readJson, sendJson } from './http.ts'
import { accountEmail, accountName, bikeInput, bookingInput, object, password, rental, statusTransitions } from './validation.ts'

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
}
const idPattern = /^\/api\/(admin\/)?(bikes|bookings)\/([a-z\d-]+)(?:\/(image|availability|status|publication))?$/i

export function createApp(db: Db, { origin = '', staticDir = resolve('dist') } = {}) {
  const secure = origin.startsWith('https://')
  const attempts = new Map<string, { count: number; until: number }>()

  function limitAuthentication(request: IncomingMessage) {
    const key = request.socket.remoteAddress || 'unknown'
    const now = Date.now()
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip)
    const visit = attempts.get(key) ?? { count: 0, until: now + 600_000 }
    if (++visit.count > 30) throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.')
    attempts.set(key, visit)
  }

  async function api(request: IncomingMessage, response: ServerResponse, url: URL) {
    const path = url.pathname
    const method = request.method
    const query = Object.fromEntries(url.searchParams)
    if (method !== 'GET' && method !== 'HEAD') checkOrigin(request, origin)

    if (method === 'GET' && path === '/api/session') return sendJson(response, 200, currentAccount(db, request))
    if (method === 'POST' && (path === '/api/auth/sign-in' || path === '/api/auth/register')) {
      const raw = object(await readJson(request))
      const register = path.endsWith('/register')
      const email = accountEmail(raw.email)
      const secret = password(raw.password, register)
      limitAuthentication(request)
      const account = register ? await createAccount(db, accountName(raw.name), email, secret, 'customer') :
        await authenticate(db, email, secret)
      startSession(db, request, response, account, secure)
      return sendJson(response, register ? 201 : 200, account)
    }
    if (method === 'POST' && path === '/api/auth/sign-out') {
      endSession(db, request, response, secure)
      return sendJson(response, 200, null)
    }

    if (method === 'GET' && path === '/api/bikes') return sendJson(response, 200, listPublicBikes(db, rental(query, false)))
    if (path === '/api/bookings' && method === 'GET') {
      return sendJson(response, 200, listBookings(db, requireAccount(db, request, 'customer')))
    }
    if (path === '/api/bookings' && method === 'POST') {
      const account = requireAccount(db, request, 'customer')
      return sendJson(response, 201, bookBike(db, account, bookingInput(await readJson(request))))
    }
    if (path.startsWith('/api/admin/')) requireAccount(db, request, 'admin')
    if (path === '/api/admin/bikes') {
      if (method === 'GET') return sendJson(response, 200, listManagedBikes(db))
      if (method === 'POST') return sendJson(response, 201, saveBike(db, bikeInput(await readJson(request, 3 * 1024 * 1024))))
    }
    if (method === 'GET' && path === '/api/admin/bookings') return sendJson(response, 200, listBookings(db))

    const match = idPattern.exec(path)
    if (match) {
      const [, admin, kind, id, action] = match
      if (!admin && kind === 'bikes' && method === 'GET') {
        if (action === 'availability') return sendJson(response, 200, quoteBike(db, id, rental(query, true)).quote)
        if (action === 'image') {
          const image = bikeImage(db, id)
          if (!image) throw new HttpError(404, 'Image not found.')
          response.writeHead(200, { 'Content-Type': image.mime, 'Content-Length': image.bytes.length, 'Cache-Control': 'no-cache' })
          response.end(image.bytes)
          return
        }
      }
      if (admin && kind === 'bikes' && !action && method === 'PUT') {
        return sendJson(response, 200, saveBike(db, bikeInput(await readJson(request, 3 * 1024 * 1024)), id))
      }
      if (admin && kind === 'bikes' && action === 'publication' && method === 'PATCH') {
        const { active } = object(await readJson(request))
        if (typeof active !== 'boolean') throw new HttpError(400, 'Select a publication status.')
        return sendJson(response, 200, setBikeActive(db, id, active))
      }
      if (kind === 'bookings' && action === 'status' && method === 'PATCH') {
        const account = requireAccount(db, request, admin ? 'admin' : 'customer')
        const { status } = object(await readJson(request))
        if (typeof status !== 'string' || !Object.hasOwn(statusTransitions, status)) throw new HttpError(400, 'Select a valid booking status.')
        return sendJson(response, 200, changeBooking(db, id, account, status as BookingStatus))
      }
    }
    throw new HttpError(404, 'API route not found.')
  }

  async function serveStatic(request: IncomingMessage, response: ServerResponse, pathname: string) {
    if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.')
    const extension = extname(pathname)
    if (extension && !Object.hasOwn(mimeTypes, extension)) throw new HttpError(404, 'File not found.')
    const file = extension ? resolve(staticDir, '.' + decodeURIComponent(pathname)) : resolve(staticDir, 'index.html')
    if (!file.startsWith(resolve(staticDir) + sep)) throw new HttpError(404, 'File not found.')
    const metadata = await stat(file).catch(() => null)
    if (!metadata?.isFile()) throw new HttpError(extension ? 404 : 503, extension ? 'File not found.' : 'Build RIDEON before starting the server.')
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension || '.html'], 'Content-Length': metadata.size,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    })
    if (request.method === 'HEAD') response.end()
    else createReadStream(file).on('error', () => response.destroy()).pipe(response)
  }

  return createServer({ requestTimeout: 30_000 }, async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'same-origin')
    try {
      const url = new URL(request.url || '/', 'http://localhost')
      if (url.pathname.startsWith('/api/') || url.pathname === '/api') await api(request, response, url)
      else await serveStatic(request, response, url.pathname)
    } catch (error) {
      if (!(error instanceof HttpError)) console.error(error)
      if (!response.headersSent) {
        sendJson(response, error instanceof HttpError ? error.status : 500,
          { error: error instanceof HttpError ? error.message : 'The server could not complete this request.' })
      } else response.end()
    }
  })
}
