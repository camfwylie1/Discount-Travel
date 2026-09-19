import { config } from 'dotenv'

config({ path: '.env', quiet: true })

// Integration tests run against TEST_DATABASE_URL so the development database
// is never touched. Unit tests do not touch a database at all.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-value-at-least-32-characters'
