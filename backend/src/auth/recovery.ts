import { randomBytes } from 'node:crypto'
import type { Request, RequestHandler, Response, Router } from 'express'
import { readCookie } from './session.ts'
import { authCallbackUrl, HttpError } from '../http.ts'
import type { SupabaseGateway } from '../supabase.ts'
import { accountEmail, confirmedPassword, object } from '../validation.ts'

const callbackPath = '/api/auth/recovery/callback'
const verifierCookie = 'rideon_reset_verifier'
const accessCookie = 'rideon_reset_access'
const refreshCookie = 'rideon_reset_refresh'

export function mountPasswordRecovery(
  router: Router,
  gateway: SupabaseGateway,
  { origin, parseJson, limit, clearSession }: {
    origin: string
    parseJson: RequestHandler
    limit: (request: Request) => void
    clearSession: (response: Response) => void
  },
) {
  const cookieSettings = {
    path: '/api/auth/recovery', httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https://'),
  } as const

  function clearRecovery(response: Response) {
    response.clearCookie(accessCookie, cookieSettings)
    response.clearCookie(refreshCookie, cookieSettings)
  }

  router.post('/auth/forgot-password', parseJson, async (request, response) => {
    limit(request)
    const email = accountEmail(object(request.body).email)
    const verifier = await gateway.sendRecoveryEmail(email, authCallbackUrl(request, origin, callbackPath))
    clearRecovery(response)
    // Return the same response shape even when the provider does not issue a verifier.
    const placeholder = JSON.stringify(randomBytes(28).toString('hex') + '/recovery')
    response.cookie(verifierCookie, verifier ?? placeholder, { ...cookieSettings, maxAge: 3_600_000 })
    response.status(202).json(null)
  })

  router.get('/auth/recovery/callback', async (request, response) => {
    response.set('Referrer-Policy', 'no-referrer')
    const verifier = readCookie(request, verifierCookie)
    const code = request.query.code
    if (verifier && typeof code === 'string' && code.length && code.length <= 1024) {
      const session = await gateway.exchangeRecoveryCode(code, verifier)
      response.clearCookie(verifierCookie, cookieSettings)
      if (session) {
        const maxAge = 600_000
        response.cookie(accessCookie, session.access_token, { ...cookieSettings, maxAge })
        response.cookie(refreshCookie, session.refresh_token, { ...cookieSettings, maxAge })
      }
    }
    response.redirect(303, '/reset-password')
  })

  router.get('/auth/recovery/session', (request, response) => {
    response.json({ ready: Boolean(readCookie(request, accessCookie) && readCookie(request, refreshCookie)) })
  })

  router.post('/auth/recovery/password', parseJson, async (request, response) => {
    const access = readCookie(request, accessCookie)
    const refresh = readCookie(request, refreshCookie)
    if (!access || !refresh) throw new HttpError(401, 'Your reset link has expired. Request a new one.')
    const raw = object(request.body)
    await gateway.updateRecoveryPassword(access, refresh, confirmedPassword(raw.password, raw.confirmPassword))
    clearRecovery(response)
    clearSession(response)
    response.json(null)
  })
}
