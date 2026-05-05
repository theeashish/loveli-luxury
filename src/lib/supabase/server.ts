/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Uses the cookie store to maintain auth state.
 *
 * The anon key is used here too. Server-only operations that need to bypass
 * RLS use createServiceClient() instead.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '../env'
import type { Database } from '../../types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot set cookies. Middleware handles refresh.
          }
        },
      },
    }
  )
}
