import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.d.ts',
        'src/types/**',
        // Server-coupled modules — covered by integration tests in tests/integration/
        'src/lib/supabase/**',
        'src/lib/flutterwave/**',
        'src/lib/env.ts',
        'src/lib/catalog/queries.ts',
        'src/lib/catalog/mutations.ts',
        'src/lib/catalog/storage.ts',
        'src/lib/cart/store.ts',
        'src/lib/auth/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' throws when loaded outside an RSC bundle. In tests we
      // run the same modules in plain Node, so swap in a no-op shim. The real
      // package still gates client bundles in production.
      'server-only': path.resolve(__dirname, './tests/shims/server-only.ts'),
      // pglite ships its contrib extensions behind an `exports` subpath
      // ("./contrib/*") that Node resolves but Vite's resolver does not, so
      // the integration harness fails to load under Vitest. Point Vite at the
      // built files directly. (Node-run scripts don't need this.)
      '@electric-sql/pglite/contrib/pgcrypto': path.resolve(
        __dirname,
        'node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js',
      ),
      '@electric-sql/pglite/contrib/citext': path.resolve(
        __dirname,
        'node_modules/@electric-sql/pglite/dist/contrib/citext.js',
      ),
      '@electric-sql/pglite/contrib/uuid_ossp': path.resolve(
        __dirname,
        'node_modules/@electric-sql/pglite/dist/contrib/uuid_ossp.js',
      ),
    },
  },
})
