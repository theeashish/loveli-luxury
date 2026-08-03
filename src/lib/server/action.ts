import "server-only";

import { authorize } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Permission } from "@/lib/auth";

export type ActionContext = {
  session: Awaited<ReturnType<typeof authorize>>;
  db: SupabaseClient<Database>;
};

export async function createActionContext(
  permission: Permission,
): Promise<ActionContext> {
  const session = await authorize(permission);

  return {
    session,
    db: createServiceClient(),
  };
}