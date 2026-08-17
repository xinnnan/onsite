import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, assertFound } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const body = await request.json() as { password?: string };
    if (!body.password || body.password.length < 8 || body.password.length > 128) throw new ApiError(400, "PASSWORD_REQUIREMENTS");
    if (demo) return NextResponse.json({ ok: true, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: target } = await admin.from("profiles").select("id,auth_user_id,username").eq("id", id).single();
    const targetProfile = assertFound(target, "USER_NOT_FOUND");
    const { error } = await admin.auth.admin.updateUserById(targetProfile.auth_user_id, { password: body.password });
    if (error) throw new ApiError(409, "PASSWORD_RESET_FAILED", error.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "WORKER_PASSWORD_RESET", entityType: "PROFILE", entityId: id, oldValue: { password: "[REDACTED]" }, newValue: { password: "[REDACTED]" }, reason: "Administrator reset password" });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
