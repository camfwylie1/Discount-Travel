import next from 'eslint-config-next'
import tseslint from '@typescript-eslint/eslint-plugin'

/**
 * Flat config.
 *
 * `eslint-config-next` exports an ARRAY of config objects, not a factory, so
 * it is spread rather than called. Its second block registers the
 * `@typescript-eslint` plugin, but flat config scopes plugin names to the
 * object that declares them, so the override block below has to declare it
 * again before it can touch those rules.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      'next-env.d.ts',
    ],
  },
  ...next,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
]

export default config
