/**
 * Test stub for the `server-only` package.
 *
 * In the application, importing `server-only` makes the build fail if a
 * server module is ever pulled into a client bundle — a genuinely valuable
 * guard. Under Vitest there is no client bundle, so it is replaced with this
 * empty module. The real guard is unaffected.
 */
export {}
