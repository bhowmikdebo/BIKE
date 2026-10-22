import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(payload))
}

export async function readJson(request: IncomingMessage, limit = 32_768): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'Use the application/json content type.')
  }
  if (Number(request.headers['content-length']) > limit) throw new HttpError(413, 'This upload is too large.')

  let size = 0
  const chunks: Buffer[] = []
  // Continue consuming oversized bodies without buffering them so the 413 can be delivered.
  for await (const chunk of request) {
    size += chunk.length
    if (size <= limit) chunks.push(chunk)
  }
  if (size > limit) throw new HttpError(413, 'This upload is too large.')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new HttpError(400, 'Invalid JSON request.')
  }
}

export function checkOrigin(request: IncomingMessage, allowedOrigin: string) {
  const origin = request.headers.origin
  const localOrigin = `http://${request.headers.host}`
  if (request.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== (allowedOrigin || localOrigin))) {
    throw new HttpError(403, 'This request must come from RIDEON.')
  }
}
