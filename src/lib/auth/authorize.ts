import "server-only";

import {
  AuthError,
  getSession,
  isSuperadmin,
  type Session,
} from "./roles";

import {
  type Permission,
} from "./permissions";

import {
  ROLE_PERMISSIONS,
} from "./role-permissions";

export function hasPermission(
  session: Session,
  permission: Permission,
): boolean {

  if (isSuperadmin(session)) {
    return true;
  }

  for (const role of session.roles) {

    const permissions = ROLE_PERMISSIONS[role];

    if (!permissions) {
      continue;
    }

    if (permissions.has(permission)) {
      return true;
    }

  }

  return false;

}

export async function authorize(
  permission: Permission,
): Promise<Session> {

  const session = await getSession();

  if (!session) {
    throw new AuthError("UNAUTHENTICATED");
  }

  if (!hasPermission(session, permission)) {
    throw new AuthError("FORBIDDEN");
  }

  return session;

}