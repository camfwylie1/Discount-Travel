import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws outside a React Server Component. In tests we
      // ARE the server, so it is aliased to a no-op. This does not weaken
      // the guard in the application itself.
      'server-only': new URL('./src/tests/server-only-stub.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
    setupFiles: ['src/tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
})
