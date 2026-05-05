/**
 * Service-role Supabase client. BYPASSES RLS.
 *
 * Use ONLY in trusted server contexts:
 *   - Webhook handlers (Flutterwave callbacks)
 *   - Commission engine batch jobs
 *   - Monthly salary close
 *   - Payout reconciliation
 *
 * NEVER import this from a client component or route that runs in the browser.
 * NEVER import from middleware.
 *
 * The service-role key has the equivalent of root-level database access.
 */

import { createClient } from '@supabase/supabase-js'
import { publicEnv, getServerEnv } from '../env'
import type { Database } from '../../types/database'

export function createServiceClient() {
  const serverEnv = getServerEnv()

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
