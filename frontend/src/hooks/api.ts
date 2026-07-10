import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../utils/api'

type Result<T> = { path: string; data?: T; error?: string }

export function useApi<T>(path: string | null) {
  const [result, setResult] = useState<Result<T>>()
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion(value => value + 1), [])

  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    api<T>(path, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ path, data }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ path, error: errorMessage(error) }) })
    return () => controller.abort()
  }, [path, version])

  const visible = result?.path === path ? result : undefined
  return {
    data: visible?.data,
    error: visible?.error,
    loading: Boolean(path && !visible),
    refresh,
    reload: () => { setResult(undefined); refresh() },
  }
}
