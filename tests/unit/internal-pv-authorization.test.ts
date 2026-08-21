import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
import {
  FOUNDER_ADMIN_USER_ID,
  RUTH_ADMIN_USER_ID,
  isInternalViewer,
  type Session,
} from "@/lib/auth/roles";

function session(userId: string, roles: Session["roles"]): Session {
  return { userId, email: null, roles };
}

describe("internal PV viewer authorization", () => {
  it("allows the founder superadmin", () => {
    expect(
      isInternalViewer(session(FOUNDER_ADMIN_USER_ID, new Set(["superadmin"]))),
    ).toBe(true);
  });

  it("allows Ruth only while her superadmin role is active", () => {
    expect(
      isInternalViewer(session(RUTH_ADMIN_USER_ID, new Set(["superadmin"]))),
    ).toBe(true);
    expect(
      isInternalViewer(session(RUTH_ADMIN_USER_ID, new Set(["admin"]))),
    ).toBe(false);
  });

  it("rejects other superadmins and ordinary users", () => {
    expect(
      isInternalViewer(
        session(
          "9d2f8dc9-8d3a-45bd-89f1-14a8eb9e9d4e",
          new Set(["superadmin"]),
        ),
      ),
    ).toBe(false);
    expect(
      isInternalViewer(
        session(
          "2f1b3f12-9e5d-46dc-9856-cb7a84ecb293",
          new Set(["distributor"]),
        ),
      ),
    ).toBe(false);
  });
});
