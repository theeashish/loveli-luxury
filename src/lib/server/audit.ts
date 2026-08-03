import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

export type AuditInput = {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: Json;
  after?: Json;
};

export async function audit(
  db: SupabaseClient<Database>,
  input: AuditInput,
): Promise<void> {
  const { error } = await db
    .from("audit_log")
    .insert({
      actor_id: input.actorId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      before_data: input.before ?? null,
      after_data: input.after ?? null,
    });

  if (error) {
    throw error;
  }
}