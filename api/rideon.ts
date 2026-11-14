import type { IncomingMessage, ServerResponse } from 'node:http'
import { configuredApp } from '../backend/src/configured-app.ts'

const app = configuredApp()

export default function handler(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const path = url.searchParams.get('__rideon_path')
  if (url.pathname === '/api/rideon' && path && /^[a-z0-9/-]+$/i.test(path)) url.pathname = '/api/' + path
  url.searchParams.delete('__rideon_path')
  request.url = url.pathname + url.search
  app(request, response)
}
