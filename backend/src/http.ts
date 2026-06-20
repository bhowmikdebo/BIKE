import type { Request } from 'express'

export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function checkOrigin(request: Request, allowedOrigin: string) {
  const origin = request.get('origin')
  const expected = allowedOrigin || `http://${request.get('host')}`
  if (request.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected)) {
    throw new HttpError(403, 'This request must come from RIDEON.')
  }
}

export function authCallbackUrl(request: Request, origin: string, path: string) {
  if (origin) return new URL(path, origin).href
  const host = request.get('host') ?? ''
  if (!/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) {
    throw new HttpError(503, 'Account links are unavailable on this hostname.')
  }
  return new URL(path, `http://${host}`).href
}

export function resourceId(request: Request, parameter = 'id') {
  const id = request.params[parameter]
  if (typeof id !== 'string' || !/^[a-z0-9-]{1,90}$/i.test(id)) throw new HttpError(404, 'Bike or booking not found.')
  return id
}
