import type { Request, RequestHandler, Response, Router } from 'express'
import { authReturnPath } from '../../shared/auth.ts'
import { readCookie } from './auth.ts'
import type { createSessionManager } from './auth.ts'
import { authCallbackUrl } from './http.ts'
import type { SupabaseGateway } from './supabase.ts'
import { accountEmail, accountName, confirmedPassword, object } from './validation.ts'

const emailCallback = '/api/auth/email/callback'
const googleCallback = '/api/auth/google/callback'
const emailCookie = 'rideon_email_pending'
const googleCookie = 'rideon_google_pending'

function readPending(request: Request, name: string) {
  try {
    const value = JSON.parse(readCookie(request, name) ?? 'null') as { verifier?: unknown; next?: unknown } | null
    return {
      verifier: typeof value?.verifier === 'string' ? value.verifier : null,
      next: authReturnPath(value?.next),
    }
  } catch {
    return { verifier: null, next: null }
  }
}

function callbackCode(request: Request) {
  const { code, error, error_code: errorCode } = request.query
  if (!error && !errorCode && typeof code === 'string' && code.length > 0 && code.length <= 1024) return code
  return null
}

function returnToSignIn(response: Response, next: string | null, status?: string) {
  const params = new URLSearchParams()
  if (next) params.set('next', next)
  if (status) params.set('auth', status)
  response.redirect(303, params.size ? '/sign-in?' + params : '/sign-in')
}

export function mountAccountEntry(router: Router, gateway: SupabaseGateway, { origin, parseJson, limit, sessions }: {
  origin: string
  parseJson: RequestHandler
  limit: (request: Request) => void
  sessions: ReturnType<typeof createSessionManager>
}) {
  const cookie = { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https://') } as const
  const emailOptions = { ...cookie, path: emailCallback }
  const googleOptions = { ...cookie, path: googleCallback }

  router.post('/auth/register', parseJson, async (request, response) => {
    limit(request)
    const raw = object(request.body)
    const { session, verifier } = await gateway.register(
      accountName(raw.name), accountEmail(raw.email), confirmedPassword(raw.password, raw.confirmPassword),
      authCallbackUrl(request, origin, emailCallback),
    )
    if (!session && verifier) {
      response.cookie(emailCookie, JSON.stringify({ verifier, next: authReturnPath(raw.next) }), { ...emailOptions, maxAge: 3_600_000 })
    }
    response.status(201).json(session ? await sessions.start(response, session) : null)
  })

  router.get('/auth/email/callback', async (request, response) => {
    response.set('Referrer-Policy', 'no-referrer')
    const { verifier, next } = readPending(request, emailCookie)
    response.clearCookie(emailCookie, emailOptions)
    const code = callbackCode(request)
    if (!code) return returnToSignIn(response, next, 'email-link')
    if (verifier) {
      try {
        const session = await gateway.exchangeSignInCode(code, verifier)
        if (session) await sessions.start(response, session)
      } catch { /* Email confirmation can complete independently of sign-in. */ }
    }
    returnToSignIn(response, next, 'confirmed')
  })

  router.post('/auth/google/start', parseJson, async (request, response) => {
    limit(request)
    const { next } = object(request.body)
    const { url, verifier } = await gateway.startGoogle(authCallbackUrl(request, origin, googleCallback))
    response.cookie(googleCookie, JSON.stringify({ verifier, next: authReturnPath(next) }), { ...googleOptions, maxAge: 600_000 })
    response.json({ url })
  })

  router.get('/auth/google/callback', async (request, response) => {
    response.set('Referrer-Policy', 'no-referrer')
    const { verifier, next } = readPending(request, googleCookie)
    response.clearCookie(googleCookie, googleOptions)
    const code = callbackCode(request)
    if (request.query.error === 'access_denied') return returnToSignIn(response, next, 'google-cancelled')
    if (code && verifier) {
      try {
        const session = await gateway.exchangeSignInCode(code, verifier)
        if (session) {
          await sessions.start(response, session)
          return returnToSignIn(response, next)
        }
      } catch { /* Return the user to the form if the session cannot be established. */ }
    }
    returnToSignIn(response, next, 'google-failed')
  })
}
