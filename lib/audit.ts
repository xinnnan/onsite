import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

/** Names who acted in audit reasons, now that managers make some changes too. */
export function actorTitle(role: UserRole) {
  return role === "MANAGER" ? "Manager" : "Administrator";
}

export async function writeAuditLog({ adminUserId, action, entityType, entityId, oldValue, newValue, reason }: {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason: string;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    reason,
  });
  if (error) throw error;
}
