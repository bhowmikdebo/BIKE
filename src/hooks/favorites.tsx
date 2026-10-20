import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const key = 'rideon-favorites'
const Favorites = createContext<{ ids: string[]; toggle: (id: string) => void }>({ ids: [], toggle: () => {} })

function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState(readFavorites)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(ids))
    } catch {
      // Favorites remain available for this page session.
    }
  }, [ids])
  const toggle = (id: string) => setIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  return <Favorites.Provider value={{ ids, toggle }}>{children}</Favorites.Provider>
}

export const useFavorites = () => useContext(Favorites)
