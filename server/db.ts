import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { seedBikes } from '../src/data/fleet.ts'

export type Db = DatabaseSync
export const databasePath = () => process.env.RIDEON_DB || '.rideon/rideon.sqlite'

export function transaction<T>(db: Db, operation: () => T) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = operation()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function openDatabase(path = databasePath()) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path)
  if (path !== ':memory:') chmodSync(path, 0o600)
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
  transaction(db, () => {
    if (db.prepare('PRAGMA user_version').get()?.user_version !== 0) return
    db.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('customer', 'admin'))
      ) STRICT;
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE bikes (
        id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK (json_valid(data)),
        active INTEGER NOT NULL CHECK (active IN (0, 1))
      ) STRICT;
      CREATE TABLE bike_images (
        bike_id TEXT PRIMARY KEY REFERENCES bikes(id) ON DELETE CASCADE,
        mime TEXT NOT NULL, bytes BLOB NOT NULL
      ) STRICT;
      CREATE TABLE bookings (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES accounts(id),
        bike_id TEXT NOT NULL REFERENCES bikes(id), bike_name TEXT NOT NULL,
        rider_name TEXT NOT NULL, rider_email TEXT NOT NULL, phone TEXT NOT NULL,
        city TEXT NOT NULL, pickup TEXT NOT NULL, return_date TEXT NOT NULL CHECK (return_date > pickup),
        days INTEGER NOT NULL CHECK (days > 0), daily_rate INTEGER NOT NULL CHECK (daily_rate > 0),
        total INTEGER NOT NULL CHECK (total = daily_rate * days),
        status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
        created_at TEXT NOT NULL, request_key TEXT NOT NULL, UNIQUE (user_id, request_key)
      ) STRICT;
      CREATE INDEX bookings_by_availability ON bookings (bike_id, pickup, return_date)
        WHERE status IN ('pending', 'confirmed', 'in_progress');
      CREATE INDEX bookings_by_customer ON bookings (user_id, created_at DESC);
      PRAGMA user_version = 1;
    `)
    const insert = db.prepare('INSERT INTO bikes (id, data, active) VALUES (?, ?, 1)')
    for (const { id, ...data } of seedBikes) insert.run(id, JSON.stringify(data))
  })
  return db
}
