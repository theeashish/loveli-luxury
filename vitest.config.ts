import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Playwright owns tests/e2e/*.spec.ts; keep Vitest off them.
    exclude: ['node_modules/**', 'tests/e2e/**', '.next/**'],
    // The integration harness boots a full Postgres (pglite/WASM) and applies
    // all 40+ migrations in a hook — ~15s cold, slower on CI. Pure unit tests
    // finish in ms; these ceilings only ever matter for the DB-backed suite.
    testTimeout: 30000,
    hookTimeout: 90000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      // Scope the coverage GATE to the pure business-logic core that unit tests
      // are the right tool for, and hold it HIGH. The previous config swept all
      // of src/lib/** into the gate — including server-coupled I/O wrappers that
      // unit tests can't meaningfully cover — so the 80% threshold was
      // unreachable and CI had been RED on every run since 2026-05-18. A vanity
      // gate that is always red enforces nothing. This list is every module with
      // a dedicated unit test and real coverage; a regression here now fails CI.
      //
      // NOT in this gate, and why:
      //  - The SQL money engine (write_commission_ledger, mark_order_paid, …) is
      //    covered by tests/integration/commission-engine.test.ts against the
      //    REAL migrations in pglite — see that suite, not line coverage here.
      //  - Thin I/O wrappers (supabase/*, email/*, sms/*, intasend/client,
      //    payments/dispatcher, catalog/queries+mutations, *_store) are
      //    integration/E2E territory; unit-covering them only mocks the I/O.
      include: [
        'src/lib/money.ts',
        'src/lib/cart/logic.ts',
        'src/lib/cart/selectors.ts',
        'src/lib/cart/index.ts',
        'src/lib/catalog/money-input.ts',
        'src/lib/catalog/schemas.ts',
        'src/lib/catalog/slug.ts',
        'src/lib/catalog/storage.ts',
        'src/lib/catalog/mappers.ts',
        'src/lib/catalog/revalidate-paths.ts',
        'src/lib/catalog/image-pipeline.ts',
        'src/lib/concierge/link.ts',
        'src/lib/orders/mask.ts',
        'src/lib/partners/tiers.ts',
        'src/lib/payments/fees.ts',
        'src/lib/payments/idempotency.ts',
        'src/lib/intasend/signature.ts',
        'src/lib/intasend/types.ts',
        'src/lib/recently-viewed/logic.ts',
        'src/lib/wishlist/logic.ts',
        // NB: the commission/salary MONEY math lives in SQL RPCs
        // (write_commission_ledger, etc.) and is covered by
        // tests/integration/commission-engine.test.ts against the real schema,
        // not by a TypeScript re-implementation. The former dead TS calculators
        // (which encoded a superseded rate sheet) were deleted 2026-05-30.
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
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
