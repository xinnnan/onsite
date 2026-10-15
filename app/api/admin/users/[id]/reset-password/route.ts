import { NextResponse } from "next/server";
import { isWorkerInScope } from "@/lib/access-scope";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireScopedAccess } from "@/lib/auth-context";
import { actorTitle, writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo, scope } = await requireScopedAccess();
    const { id } = await params;
    const body = await request.json() as { password?: string };
    if (!body.password || body.password.length < 8 || body.password.length > 128) throw new ApiError(400, "PASSWORD_REQUIREMENTS");
    if (demo) return NextResponse.json({ ok: true, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: targetProfile } = await admin.from("profiles").select("id,auth_user_id,username,role,status,company").eq("id", id).maybeSingle();
    // Managers reset passwords only for their own company's active workers.
    if (!targetProfile || !isWorkerInScope(scope, targetProfile)) throw new ApiError(404, "USER_NOT_FOUND");
    const { error } = await admin.auth.admin.updateUserById(targetProfile.auth_user_id, { password: body.password });
    if (error) throw new ApiError(409, "PASSWORD_RESET_FAILED", error.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "WORKER_PASSWORD_RESET", entityType: "PROFILE", entityId: id, oldValue: { password: "[REDACTED]" }, newValue: { password: "[REDACTED]" }, reason: `${actorTitle(adminProfile.role)} reset password` });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
