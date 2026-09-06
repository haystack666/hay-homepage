import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import process from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const rootDirectory = path.resolve(currentDirectory, '../..')
const databaseDirectory = path.join(rootDirectory, 'data')
const databasePath = path.join(databaseDirectory, 'haystack-e2e.db')

await mkdir(databaseDirectory, { recursive: true })
await Promise.all([
  rm(databasePath, { force: true }),
  rm(`${databasePath}-shm`, { force: true }),
  rm(`${databasePath}-wal`, { force: true }),
])

const child = spawn('go', ['run', './cmd/haystack'], {
  cwd: rootDirectory,
  env: {
    ...process.env,
    HAYSTACK_ADDR: '127.0.0.1:18080',
    HAYSTACK_DB_PATH: databasePath,
    HAYSTACK_WEB_DIST: path.join(rootDirectory, 'web', 'dist'),
    HAYSTACK_BASE_URL: 'http://127.0.0.1:18080',
    HAYSTACK_ADMIN_PASSWORD_HASH:
      '$2a$04$aHXJHIif.TG0kvaooHl6h.2ZbGp2Gkfe/U4.o5umwZHC8kdT6lsvi',
    HAYSTACK_SESSION_TTL: '1h',
    HAYSTACK_ENV: 'development',
  },
  stdio: 'inherit',
})

const stop = (signal) => {
  child.kill(signal)
}

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 1)
})
