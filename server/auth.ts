import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promisify } from 'node:util'
import type { Account } from '../src/types.ts'
import type { Db } from './db.ts'
import { HttpError } from './http.ts'

const deriveKey = promisify(scrypt)
const cookieName = 'rideon_session'
const ttl = 7 * 24 * 60 * 60
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
type AccountRow = Account & { password_hash: string }

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await deriveKey(password, salt, 64) as Buffer
  return `${salt}:${key.toString('hex')}`
}

export async function createAccount(db: Db, name: string, email: string, password: string, role: Account['role']) {
  const id = randomUUID()
  const hash = await hashPassword(password)
  const result = db.prepare(`
    INSERT INTO accounts (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(email) DO NOTHING
  `).run(id, name, email, hash, role)
  if (result.changes === 0) throw new HttpError(409, 'An account already uses that email address.')
  return { id, name, email, role }
}

export async function authenticate(db: Db, email: string, password: string) {
  const row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email) as AccountRow | undefined
  // Derive a key for unknown addresses too so a failed sign-in follows the same work path.
  const [salt, stored] = (row?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':')
  const actual = await deriveKey(password, salt, 64) as Buffer
  if (!timingSafeEqual(actual, Buffer.from(stored, 'hex')) || !row) throw new HttpError(401, 'Email or password is incorrect.')
  return { id: row.id, name: row.name, email: row.email, role: row.role }
}

function requestToken(request: IncomingMessage) {
  return request.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9]{64})(?:;|$)`))?.[1]
}

export function currentAccount(db: Db, request: IncomingMessage) {
  const token = requestToken(request)
  if (!token) return null
  return db.prepare(`
    SELECT a.id, a.name, a.email, a.role
    FROM sessions s JOIN accounts a ON s.user_id = a.id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash(token), Date.now()) as Account | undefined ?? null
}

export function requireAccount(db: Db, request: IncomingMessage, role?: Account['role']) {
  const account = currentAccount(db, request)
  if (!account) throw new HttpError(401, 'Sign in to continue.')
  if (role && account.role !== role) throw new HttpError(403, 'Your account cannot access this page.')
  return account
}

function setCookie(response: ServerResponse, token: string, age: number, secure: boolean) {
  response.setHeader('Set-Cookie', `${cookieName}=${token}; Max-Age=${age}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`)
}

export function endSession(db: Db, request: IncomingMessage, response: ServerResponse, secure: boolean) {
  const token = requestToken(request)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token))
  setCookie(response, '', 0, secure)
}

export function startSession(db: Db, request: IncomingMessage, response: ServerResponse, account: Account, secure: boolean) {
  endSession(db, request, response, secure)
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash(token), account.id, Date.now() + ttl * 1000)
  setCookie(response, token, ttl, secure)
}
