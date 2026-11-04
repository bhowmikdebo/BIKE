import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

interface Config { url: string; key: string; emailRedirect?: string }

export interface SupabaseGateway {
  rpc<T>(name: string, args?: Record<string, unknown>, accessToken?: string): Promise<T>
  signIn(email: string, password: string): Promise<Session>
  register(name: string, email: string, password: string): Promise<Session | null>
  sendRecoveryEmail(email: string, redirectTo: string): Promise<string | null>
  exchangeRecoveryCode(code: string, verifier: string): Promise<Session | null>
  updateRecoveryPassword(accessToken: string, refreshToken: string, password: string): Promise<void>
  refresh(refreshToken: string): Promise<Session | null>
  signOut(accessToken: string): Promise<void>
}

function authFailure(error: { status?: number; code?: string }, message: string) {
  if (error.code === 'email_not_confirmed') return new HttpError(403, 'Confirm your email before signing in.')
  if (error.status === 429) return new HttpError(429, 'Too many authentication requests. Try again in a few minutes.')
  if (!error.status || error.status >= 500) return new HttpError(503, 'Supabase Auth is temporarily unavailable.')
  return new HttpError(error.status, message)
}

export function createSupabaseGateway(config: Config): SupabaseGateway {
  const options = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  const client = () => createClient(config.url, config.key, { auth: options })
  const storageKey = 'rideon-auth'
  const verifierKey = storageKey + '-code-verifier'

  function pkceClient(verifier?: string) {
    const storage = new Map<string, string>()
    if (verifier) storage.set(verifierKey, verifier)
    const auth = createClient(config.url, config.key, { auth: {
      ...options, flowType: 'pkce', storageKey, persistSession: true,
      storage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value) },
        removeItem: key => { storage.delete(key) },
      },
    } }).auth
    return { auth, readVerifier: () => storage.get(verifierKey) ?? null }
  }

  async function exchangeCode(code: string, verifier: string, recovery: boolean) {
    const { data, error } = await pkceClient(verifier).auth.exchangeCodeForSession(code)
    if (error && (!error.status || error.status >= 500)) throw authFailure(error, 'Could not verify the account link.')
    const isRecovery = 'redirectType' in data && data.redirectType === 'recovery'
    return isRecovery === recovery ? data.session : null
  }

  return {
    async rpc<T>(name: string, args = {}, accessToken?: string) {
      const db = accessToken
        ? createClient(config.url, config.key, { accessToken: async () => accessToken })
        : client()
      const { data, error, status } = await db.rpc('rideon_api', { operation: name, payload: args })
      if (error) {
        if (/^PT4\d{2}$/.test(error.code)) throw new HttpError(Number(error.code.slice(2)), error.message)
        if (status === 401) throw new HttpError(401, 'Sign in to continue.')
        if (error.code === '42501') throw new HttpError(403, 'Your account cannot access this operation.')
        if (error.code === '23P01' || error.code === '23505') throw new HttpError(409, 'This request conflicts with an existing record.')
        console.error('Supabase RPC failure:', name, error.code)
        throw new HttpError(503, 'The RIDEON database is temporarily unavailable.')
      }
      return data as T
    },
    async signIn(email, password) {
      const { data, error } = await client().auth.signInWithPassword({ email, password })
      if (error) throw authFailure(error, 'Email or password is incorrect.')
      if (!data.session) throw new HttpError(401, 'Unable to start a session.')
      return data.session
    },
    async register(name, email, password) {
      const { data, error } = await client().auth.signUp({
        email, password, options: { data: { name }, emailRedirectTo: config.emailRedirect },
      })
      if (error) throw authFailure(error, 'Could not create the account. Try signing in if you already have one.')
      return data.session
    },
    async sendRecoveryEmail(email, redirectTo) {
      const { auth, readVerifier } = pkceClient()
      const { error } = await auth.resetPasswordForEmail(email, { redirectTo })
      if (error) {
        if (error.code === 'user_not_found' || error.code === 'over_email_send_rate_limit') return null
        throw authFailure(error, 'Could not request a password reset. Try again shortly.')
      }
      return readVerifier()
    },
    exchangeRecoveryCode(code, verifier) {
      return exchangeCode(code, verifier, true)
    },
    async updateRecoveryPassword(accessToken, refreshToken, password) {
      const auth = client().auth
      const { error: sessionError } = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      if (sessionError) {
        if (!sessionError.status || sessionError.status >= 500) throw authFailure(sessionError, 'Could not verify the reset session.')
        throw new HttpError(401, 'This reset session has expired. Request a new link.')
      }
      const { error } = await auth.updateUser({ password })
      if (error?.code === 'same_password') throw new HttpError(422, 'Choose a password different from your current one.')
      if (error?.code === 'weak_password') throw new HttpError(422, 'Choose a stronger password and try again.')
      if (error) throw authFailure(error, 'Could not update your password. Try again.')
      await auth.signOut({ scope: 'local' })
    },
    async refresh(refreshToken) {
      const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken })
      if (error && (!error.status || error.status >= 500)) throw authFailure(error, 'Could not refresh the session.')
      return data?.session ?? null
    },
    async signOut(accessToken) {
      const { error } = await client().auth.admin.signOut(accessToken, 'local')
      if (error && error.status !== 401 && error.status !== 404) throw authFailure(error, 'Could not end the session.')
    },
  }
}
