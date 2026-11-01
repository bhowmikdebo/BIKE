export function authReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1024 || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20\x7f]/.test(value)) return null
  const base = 'https://rideon.invalid'
  const url = new URL(value, base)
  if (url.origin !== base || url.pathname.startsWith('//') || /^\/(?:api|sign-in|register|forgot-password|reset-password)(?:\/|$)/i.test(url.pathname)) return null
  return url.pathname + url.search + url.hash
}
