/**
 * Server-only role helpers.
 *
 * Single source of truth for "is this user allowed in admin routes". Used by:
 *   - middleware.ts (route gate)
 *   - admin layout.tsx (defensive in-layout check, in case middleware is ever
 *     misconfigured)
 *   - lib/catalog/mutations.ts (Server Actions assert admin before any write)
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import type { Database } from "../../types/database";

type Client = SupabaseClient<Database>;
type UserRole = Database["public"]["Enums"]["user_role"];

export type Session = {
  userId: string;
  email: string | null;
  roles: Set<UserRole>;
};

export class AuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

export async function getSession(): Promise<Session | null> {
  const supabase = (await createClient()) as unknown as Client;
  // Use getSession() (local cookie read) rather than getUser() (network
  // call). On Vercel Edge, getUser() can intermittently return null even
  // when the session cookies are present and valid, which bounces
  // legitimate admins back to /login. The user_roles lookup below is
  // still RLS-gated, so trusting the cookie here does not weaken the
  // role check.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select()
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if (error) throw error;

  return {
    userId: user.id,
    email: user.email ?? null,
    roles: new Set((roles ?? []).map((r) => r.role)),
  };
}

export function isAdmin(session: Session): boolean {
  return session.roles.has("admin") || session.roles.has("superadmin");
}

export function isSuperadmin(session: Session): boolean {
  return session.roles.has("superadmin");
}

/**
 * The founder is the sole authority for economic configuration changes.
 * Keep this identity check separate from the general superadmin check so
 * operational superadmins retain their ordinary administrative access without
 * being able to change prices, PV, or compensation settings.
 */
export const FOUNDER_ADMIN_USER_ID =
  "41c9d33c-42d1-4c7a-88d0-a275cc517853" as const;
export const RUTH_ADMIN_USER_ID =
  "dedfac7a-fb6f-457d-9ed7-7712c6e1f93e" as const;

export function isFounderAdmin(session: Session): boolean {
  return session.userId === FOUNDER_ADMIN_USER_ID && isSuperadmin(session);
}

/**
 * Internal PV records are readable only by the founder and Ruth Karimi.
 * This is deliberately separate from isAdmin(): other admins must retain
 * operational access without seeing the internal allocation ledger.
 */
export function isInternalViewer(session: Session): boolean {
  return (
    isSuperadmin(session) &&
    (session.userId === FOUNDER_ADMIN_USER_ID ||
      session.userId === RUTH_ADMIN_USER_ID)
  );
}

export async function requireFounderAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("UNAUTHENTICATED");
  if (!isFounderAdmin(session)) throw new AuthError("FORBIDDEN");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("UNAUTHENTICATED");
  if (!isAdmin(session)) throw new AuthError("FORBIDDEN");
  return session;
}

export async function requireSuperadmin(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("UNAUTHENTICATED");
  if (!isSuperadmin(session)) throw new AuthError("FORBIDDEN");
  return session;
}

/**
 * Returns a redirect target if the current admin must complete a 2FA (aal2)
 * step-up before using /admin, else null.
 *
 * INERT unless ENFORCE_ADMIN_MFA=true. FAIL-OPEN: any error → null (no
 * lockout). Only admins who have actually enrolled a TOTP factor are ever
 * asked to step up — un-enrolled admins are never blocked. This makes the
 * gate safe to ship before MFA is enabled on the Supabase project and before
 * anyone has enrolled.
 */
export async function adminMfaRedirect(): Promise<string | null> {
  const { getServerEnv } = await import("../env");
  if (!getServerEnv().ENFORCE_ADMIN_MFA) return null;
  try {
    const supabase = (await createClient()) as unknown as Client;
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return null;
    // nextLevel === 'aal2' means the user has a verified factor. If the
    // current session is below aal2, they must challenge.
    if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      return "/account/security?step_up=1";
    }
    return null;
  } catch {
    return null;
  }
}

export async function adminClient(): Promise<Client> {
  return (await createClient()) as unknown as Client;
}
