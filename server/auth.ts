import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { Account } from '../src/types.ts'
import type { Db } from './db.ts'
import { HttpError } from './http.ts'

const deriveKey = promisify(scrypt)
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
