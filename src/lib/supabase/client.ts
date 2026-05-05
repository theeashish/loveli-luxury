/**
 * Browser-side Supabase client.
 *
 * Uses the anon key. All access goes through RLS policies. The anon key is
 * safe to expose ONLY because every table has RLS enabled.
 */

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '../env'
import type { Database } from '../../types/database'

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
