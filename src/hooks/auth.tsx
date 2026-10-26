import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Account } from '../types'
import { api } from '../utils/api'
import { useApi } from './api'

interface AuthState {
  account: Account | null | undefined
  error?: string
  retry: () => void
  signIn: (email: string, password: string) => Promise<Account>
  register: (name: string, email: string, password: string) => Promise<Account>
  signOut: () => Promise<void>
}

const Context = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useApi<Account | null>('/api/session')
  const [account, setAccount] = useState<Account | null>()

  async function authenticate(path: string, body: object) {
    const user = await api<Account>(path, { method: 'POST', body })
    setAccount(user)
    return user
  }
  return <Context.Provider value={{
    account: account === undefined ? session.data : account,
    error: account === undefined ? session.error : undefined,
    retry: session.reload,
    signIn: (email, password) => authenticate('/api/auth/sign-in', { email, password }),
    register: (name, email, password) => authenticate('/api/auth/register', { name, email, password }),
    signOut: async () => { await api('/api/auth/sign-out', { method: 'POST' }); setAccount(null) },
  }}>{children}</Context.Provider>
}

export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('AuthProvider is required.')
  return value
}
