import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Account } from '../../../shared/types.ts'
import { api } from '../utils/api'
import { useApi } from './api'

interface AuthState {
  account: Account | null | undefined
  error?: string
  retry: () => void
  signIn: (email: string, password: string) => Promise<Account>
  register: (name: string, email: string, password: string) => Promise<Account | null>
  saveHostProfile: (name: string, bio: string) => Promise<Account>
  signOut: () => Promise<void>
}

const Context = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useApi<Account | null>('/api/session')
  const [account, setAccount] = useState<Account | null>()

  return <Context.Provider value={{
    account: account === undefined ? session.data : account,
    error: account === undefined ? session.error : undefined,
    retry: session.reload,
    signIn: async (email, password) => {
      const user = await api<Account>('/api/auth/sign-in', { method: 'POST', body: { email, password } })
      setAccount(user)
      return user
    },
    register: async (name, email, password) => {
      const user = await api<Account | null>('/api/auth/register', { method: 'POST', body: { name, email, password } })
      if (user) setAccount(user)
      return user
    },
    saveHostProfile: async (name, bio) => {
      const user = await api<Account>('/api/host/profile', { method: 'PUT', body: { name, bio } })
      setAccount(user)
      return user
    },
    signOut: async () => { await api('/api/auth/sign-out', { method: 'POST' }); setAccount(null) },
  }}>{children}</Context.Provider>
}

export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('AuthProvider is required.')
  return value
}
