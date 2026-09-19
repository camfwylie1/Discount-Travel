/**
 * Prepares the test database.
 *
 * Applies migrations to TEST_DATABASE_URL so integration tests always run
 * against a schema that matches the code. Safe to run repeatedly.
 */
import { execSync } from 'node:child_process'
import 'dotenv/config'

const url = process.env.TEST_DATABASE_URL
if (!url) {
  console.error('TEST_DATABASE_URL is not set. Add it to your .env file — see .env.example.')
  process.exit(1)
}
if (url === process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL must be a DIFFERENT database to DATABASE_URL. The tests wipe it.')
  process.exit(1)
}

console.log('Applying migrations to the test database…')
execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
})
console.log('Test database is ready.')
