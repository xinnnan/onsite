import { NextResponse } from "next/server";
import { accessFieldChanged, isWorkerInScope, roleCompanyError } from "@/lib/access-scope";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireScopedAccess } from "@/lib/auth-context";
import { actorTitle, writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBody, workerUpdateSchema } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { demo, scope } = await requireScopedAccess();
    const { id } = await params;
    if (demo) return NextResponse.json({ user: null, demo: true });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").select("*, project_assignments(*,project:projects(*))").eq("id", id).single();
    if (error || !isWorkerInScope(scope, data)) throw new ApiError(404, "USER_NOT_FOUND");
    return NextResponse.json({ user: data });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo, scope } = await requireScopedAccess();
    const { id } = await params;
    const body = parseBody(workerUpdateSchema, await request.json());
    // Managers edit their workers' details; roles, companies and disabling stay with administrators.
    if (scope.kind === "COMPANY" && accessFieldChanged(body)) throw new ApiError(403, "MANAGER_CANNOT_CHANGE_ACCESS");
    if (id === adminProfile.id && (body.status === "DISABLED" || (body.role && body.role !== "ADMIN"))) throw new ApiError(409, "CANNOT_REMOVE_OWN_ADMIN_ACCESS");
    if (demo) return NextResponse.json({ user: { id, ...body }, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("profiles").select("*").eq("id", id).maybeSingle();
    // Someone outside a manager's company looks exactly like someone who does not exist.
    if (!oldValue || !isWorkerInScope(scope, oldValue)) throw new ApiError(404, "USER_NOT_FOUND");
    const companyError = roleCompanyError(body.role ?? oldValue.role, body.company === undefined ? oldValue.company : body.company);
    if (companyError) throw new ApiError(400, companyError);
    const { data, error } = await admin.from("profiles").update(body).eq("id", id).select().single();
    if (error || !data) throw new ApiError(409, "USER_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: body.status === "DISABLED" ? "WORKER_DISABLED" : "WORKER_UPDATED", entityType: "PROFILE", entityId: id, oldValue, newValue: data, reason: `${actorTitle(adminProfile.role)} updated account` });
    return NextResponse.json({ user: data });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
