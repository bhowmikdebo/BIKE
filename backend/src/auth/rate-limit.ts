import { isIP } from 'node:net'
import type { Request } from 'express'
import { HttpError } from '../http.ts'

export function createAuthRateLimit(vercel: boolean) {
  const attempts = new Map<string, { count: number; until: number }>()

  return function limitAuthentication(request: Request) {
    const edgeIp = vercel ? request.get('x-vercel-forwarded-for') : undefined
    const ip = edgeIp && isIP(edgeIp) ? edgeIp : request.socket.remoteAddress || 'unknown'
    const now = Date.now()
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key)
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 600_000 }
    if (++attempt.count > 30) throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.')
    attempts.set(ip, attempt)
  }
}
