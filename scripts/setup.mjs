/**
 * ONE-TIME SETUP
 *
 *   npm install && npm run setup && npm run seed && npm run dev
 *
 * This script is written for someone who does not want to think about
 * databases. It checks what is already in place, does what it safely can, and
 * where it cannot help it prints the exact command to run rather than failing
 * with a stack trace.
 *
 * It never overwrites an existing .env and never drops an existing database.
 */
import { execSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')
const examplePath = path.join(root, '.env.example')

const tick = '✓'
const cross = '✗'
let problems = 0

function step(message) {
  console.log(`\n── ${message}`)
}
function ok(message) {
  console.log(`   ${tick} ${message}`)
}
function warn(message) {
  console.log(`   ! ${message}`)
}
function bad(message) {
  problems += 1
  console.log(`   ${cross} ${message}`)
}

function run(command, options = {}) {
  return spawnSync(command, { shell: true, encoding: 'utf8', cwd: root, ...options })
}

// ── 1. Node version ─────────────────────────────────────────────────────────
step('Checking Node')
const major = Number(process.versions.node.split('.')[0])
if (major < 20) {
  bad(`Node ${process.versions.node} is too old. Install Node 20 or newer from https://nodejs.org`)
} else {
  ok(`Node ${process.versions.node}`)
}

// ── 2. The .env file ────────────────────────────────────────────────────────
step('Checking your .env file')
if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath)
  ok('Created .env from .env.example')
} else {
  ok('.env already exists — leaving it alone')
}

let env = readFileSync(envPath, 'utf8')

// Generate a real AUTH_SECRET rather than leaving the placeholder in place.
// A predictable signing secret is a real vulnerability, not a to-do.
if (/AUTH_SECRET="?replace-me/.test(env) || /AUTH_SECRET=""/.test(env)) {
  const secret = randomBytes(48).toString('base64')
  env = env.replace(/AUTH_SECRET=.*/, `AUTH_SECRET="${secret}"`)
  writeFileSync(envPath, env)
  ok('Generated a random AUTH_SECRET')
} else {
  ok('AUTH_SECRET is already set')
}

// Load it for the rest of this script.
for (const line of env.split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/)
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
}

// ── 3. PostgreSQL ───────────────────────────────────────────────────────────
step('Checking PostgreSQL')
const dbUrl = process.env.DATABASE_URL ?? ''
const parsed = (() => {
  try {
    const u = new URL(dbUrl)
    return {
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      host: u.hostname,
      port: u.port || '5432',
      name: u.pathname.replace(/^\//, ''),
      local: ['127.0.0.1', 'localhost', '::1'].includes(u.hostname),
    }
  } catch {
    return null
  }
})()

if (!parsed) {
  bad('DATABASE_URL in .env is not a valid PostgreSQL connection string.')
} else {
  const reachable = run(`npx --yes pg-isready -h ${parsed.host} -p ${parsed.port}`).status === 0 ||
    run(`pg_isready -h ${parsed.host} -p ${parsed.port}`).status === 0

  if (!reachable && parsed.local) {
    warn('No PostgreSQL server is answering on ' + parsed.host + ':' + parsed.port + '.')
    console.log('     Start one, whichever suits you:')
    console.log('       macOS (Homebrew):  brew install postgresql@16 && brew services start postgresql@16')
    console.log('       Ubuntu/Debian:     sudo apt install postgresql && sudo service postgresql start')
    console.log('       Docker:            docker run -d --name voyaj-db -p 5432:5432 \\')
    console.log(`                            -e POSTGRES_USER=${parsed.user} -e POSTGRES_PASSWORD=${parsed.password} \\`)
    console.log(`                            -e POSTGRES_DB=${parsed.name} postgres:16`)
    console.log('     Then run `npm run setup` again.')
    problems += 1
  } else if (!reachable) {
    warn(`Could not reach ${parsed.host}:${parsed.port}. If that is a hosted database, check the URL and your network.`)
    problems += 1
  } else {
    ok(`PostgreSQL is answering on ${parsed.host}:${parsed.port}`)

    // Create the databases if they are missing. `createdb` failing because the
    // database already exists is the expected case, not an error.
    for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
      const value = process.env[key]
      if (!value) continue
      let name
      try {
        name = new URL(value).pathname.replace(/^\//, '')
      } catch {
        continue
      }
      const exists = run(
        `psql "${value.replace(/\/[^/]*$/, '/postgres')}" -tAc "SELECT 1 FROM pg_database WHERE datname='${name}'"`,
      )
      if (exists.stdout?.trim() === '1') {
        ok(`Database "${name}" already exists`)
      } else {
        const created = run(`createdb -h ${parsed.host} -p ${parsed.port} -U ${parsed.user} ${name}`, {
          env: { ...process.env, PGPASSWORD: parsed.password },
        })
        if (created.status === 0) ok(`Created database "${name}"`)
        else warn(`Could not create "${name}" automatically. Run:  createdb ${name}`)
      }
    }
  }
}

// ── 4. Prisma ───────────────────────────────────────────────────────────────
if (problems === 0) {
  step('Setting up the database schema')
  try {
    execSync('npx prisma generate', { stdio: 'inherit', cwd: root })
    ok('Generated the database client')
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: root })
    ok('Applied all migrations')
  } catch {
    bad('Migrations failed. The error above says why.')
  }

  if (process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) {
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      })
      ok('Prepared the test database')
    } catch {
      warn('Could not prepare the test database. `npm test` will tell you the same thing.')
    }
  }
}

// ── 5. What is configured, and what is not ──────────────────────────────────
step('Optional services')
const optional = [
  ['Stripe payments', !!process.env.STRIPE_SECRET_KEY, 'membership checkout shows a "not configured" state'],
  ['AI copy', process.env.AI_PROVIDER !== 'fallback' && !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    'deterministic template copy is used instead — the product is fully usable'],
  ['Real email', process.env.EMAIL_DRIVER === 'resend' && !!process.env.RESEND_API_KEY,
    'verification and reset links print to your terminal'],
  ['S3 photo storage', process.env.STORAGE_DRIVER === 's3', 'photos are written to ./public/uploads'],
]
for (const [name, configured, consequence] of optional) {
  if (configured) ok(`${name}: configured`)
  else console.log(`   – ${name}: not configured — ${consequence}`)
}

// ── Done ────────────────────────────────────────────────────────────────────
if (problems > 0) {
  console.log(`\n${cross} Setup stopped with ${problems} thing${problems === 1 ? '' : 's'} to fix. See above.\n`)
  process.exit(1)
}

console.log(`
${tick} Setup complete.

  Next:
    npm run seed     populate the demo marketplace and demo accounts
    npm run dev      start the app at http://localhost:3000

  Sign in with the demo account printed at the end of the seed.
`)
