export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, { body, ...options }: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(error => {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new Error('Cannot reach RIDEON. Check your connection and try again.')
  })
  const data: unknown = await response.json().catch(() => undefined)
  if (!response.ok || data === undefined) {
    const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'The server did not return a valid response.'
    throw new ApiError(response.status, message)
  }
  return data as T
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.'
