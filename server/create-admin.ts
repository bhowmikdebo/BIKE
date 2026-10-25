import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { stdin, stdout } from 'node:process'
import { createAccount } from './auth.ts'
import { openDatabase } from './db.ts'
import { accountEmail, accountName, password } from './validation.ts'

async function main() {
  if (!stdin.isTTY) throw new Error('Run admin:create in an interactive terminal.')
  let hidden = false
  const output = new Writable({
    write(chunk, _encoding, complete) {
      if (!hidden) stdout.write(chunk)
      complete()
    },
  })
  const prompt = createInterface({ input: stdin, output, terminal: true })
  try {
    const email = accountEmail(await prompt.question('Admin email: '))
    const name = accountName(await prompt.question('Admin name: '))
    stdout.write('Admin password (12 characters minimum): ')
    hidden = true
    const secret = password(await prompt.question(''), true)
    stdout.write('\nRepeat admin password: ')
    if (await prompt.question('') !== secret) throw new Error('The passwords do not match.')
    stdout.write('\n')
    const db = openDatabase()
    try {
      await createAccount(db, name, email, secret, 'admin')
    } finally {
      db.close()
    }
    stdout.write(`Admin account created for ${email}. Sign in at /admin.\n`)
  } finally {
    prompt.close()
  }
}

main().catch(error => {
  console.error(`\n${error instanceof Error ? error.message : 'Could not create the administrator.'}`)
  process.exitCode = 1
})
