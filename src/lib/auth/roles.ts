/**
 * Server-only role helpers.
 *
 * Single source of truth for "is this user allowed in admin routes". Used by:
 *   - middleware.ts (route gate)
 *   - admin layout.tsx (defensive in-layout check, in case middleware is ever
 *     misconfigured)
 *   - lib/catalog/mutations.ts (Server Actions assert admin before any write)
 */

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase/server'
import type { Database } from '../../types/database'

type Client = SupabaseClient<Database>
type UserRole = Database['public']['Enums']['user_role']

export type Session = {
  userId: string
  email: string | null
  roles: Set<UserRole>
}

export class AuthError extends Error {
  constructor(public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
    super(code)
  }
}

export async function getSession(): Promise<Session | null> {
  const supabase = createClient() as unknown as Client
  // Use getSession() (local cookie read) rather than getUser() (network
  // call). On Vercel Edge, getUser() can intermittently return null even
  // when the session cookies are present and valid, which bounces
  // legitimate admins back to /login. The user_roles lookup below is
  // still RLS-gated, so trusting the cookie here does not weaken the
  // role check.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const { data: roles, error } = await supabase
    .from('user_roles')
    .select()
    .eq('user_id', user.id)
    .is('revoked_at', null)
  if (error) throw error

  return {
    userId: user.id,
    email: user.email ?? null,
    roles: new Set((roles ?? []).map((r) => r.role)),
  }
}

export function isAdmin(session: Session): boolean {
  return session.roles.has('admin') || session.roles.has('superadmin')
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new AuthError('UNAUTHENTICATED')
  if (!isAdmin(session)) throw new AuthError('FORBIDDEN')
  return session
}

export function adminClient(): Client {
  return createClient() as unknown as Client
}
