import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse, assertFound } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBody, workerUpdateSchema } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { demo } = await requireAuth("ADMIN");
    const { id } = await params;
    if (demo) return NextResponse.json({ user: null, demo: true });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").select("*, project_assignments(*,project:projects(*))").eq("id", id).single();
    if (error) throw new ApiError(404, "USER_NOT_FOUND");
    return NextResponse.json({ user: data });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const { id } = await params;
    const body = parseBody(workerUpdateSchema, await request.json());
    if (id === adminProfile.id && (body.status === "DISABLED" || body.role === "WORKER")) throw new ApiError(409, "CANNOT_REMOVE_OWN_ADMIN_ACCESS");
    if (demo) return NextResponse.json({ user: { id, ...body }, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("profiles").select("*").eq("id", id).single();
    assertFound(oldValue, "USER_NOT_FOUND");
    const { data, error } = await admin.from("profiles").update(body).eq("id", id).select().single();
    if (error || !data) throw new ApiError(409, "USER_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: body.status === "DISABLED" ? "WORKER_DISABLED" : "WORKER_UPDATED", entityType: "PROFILE", entityId: id, oldValue, newValue: data, reason: "Administrator updated account" });
    return NextResponse.json({ user: data });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
