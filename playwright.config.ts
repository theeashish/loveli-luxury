import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for end-to-end smoke tests.
 *
 * Goals (deliberately narrow — this is a SMOKE suite, not full UI coverage):
 *  - Catch a deployment that breaks public routes (storefront down).
 *  - Catch auth-gating regressions (an unauthenticated user can suddenly reach
 *    /checkout or /account, or admin routes leak to non-admins).
 *  - Catch sponsor-cookie attribution drift (the MLM tree's first input).
 *  - Catch the "homepage stops rendering brand JSON-LD" SEO regression.
 *
 * Out of scope here: full UI flows (catalog admin, comp engine, payouts) and
 * anything that requires a real DB. Unit + integration tests cover those.
 *
 * Runs against a local `next start` spawned by `webServer` below. CI brings up
 * the build via the existing Build job's exact env (placeholder Supabase) so the
 * smoke pages render even without a reachable DB.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // `next start` is what Vercel runs in prod. We deliberately do NOT use
    // `next dev` — it has different middleware semantics and slower cold paths.
    command: 'npm run start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000',
      NEXT_PUBLIC_APP_NAME: 'Loveli Luxury International',
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder_anon_key_for_e2e_only',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder_service_role_key_e2e_only',
      REVALIDATE_SECRET: 'placeholder_revalidate_secret_min_32_chars_e2e',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
