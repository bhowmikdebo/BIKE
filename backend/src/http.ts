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
