import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const children = [
  spawn(process.execPath, ['--watch', 'src/index.ts'], {
    cwd: fileURLToPath(new URL('../backend/', import.meta.url)),
    stdio: 'inherit',
  }),
  spawn(process.execPath, [
    'node_modules/vite/bin/vite.js',
    ...process.argv.slice(2),
  ], {
    cwd: fileURLToPath(new URL('../frontend/', import.meta.url)),
    stdio: 'inherit',
  }),
]
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of children) if (child.exitCode === null) child.kill()
}
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => stop(code ?? 1))
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
