import { NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/access-scope";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { assertProjectInScope, fetchCompanyNames, keepScopedAssignments } from "@/lib/admin-data";
import { requireScopedAccess } from "@/lib/auth-context";
import { actorTitle, writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeProjectState } from "@/lib/us-states";
import { parseBody, projectUpdateSchema } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { demo, scope } = await requireScopedAccess();
    const { id } = await params;
    if (demo) return NextResponse.json({ project: null, companies: [], demo: true });
    // A project outside a manager's company looks exactly like one that does not exist.
    await assertProjectInScope(scope, id);
    const admin = createSupabaseAdminClient();
    const [{ data, error }, companies] = await Promise.all([
      admin.from("projects").select("*, project_assignments(*,user:profiles(id,username,display_name,company,worker_type,role,status))").eq("id", id).single(),
      scope.kind === "ALL" ? fetchCompanyNames() : Promise.resolve([]),
    ]);
    if (error || !data) throw new ApiError(404, "PROJECT_NOT_FOUND");
    let map_url: string | null = null;
    if (data.map_image_path) {
      const signed = await admin.storage.from("project-assets").createSignedUrl(data.map_image_path, 600);
      map_url = signed.data?.signedUrl || null;
    }
    return NextResponse.json({ project: { ...keepScopedAssignments(scope, data), map_url }, companies });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile, demo, scope } = await requireScopedAccess();
    const { id } = await params;
    const parsed = parseBody(projectUpdateSchema, await request.json());
    // Only administrators set a project's owning company.
    const { company, ...fields } = parsed;
    const body = scope.kind === "ALL" && company !== undefined ? { ...fields, company: normalizeCompany(company) } : fields;
    if (!Object.keys(body).length) throw new ApiError(400, "NO_CHANGES");
    if (demo) return NextResponse.json({ project: { id, ...body }, demo: true });
    await assertProjectInScope(scope, id);
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("projects").select("*").eq("id", id).maybeSingle();
    if (!oldValue) throw new ApiError(404, "PROJECT_NOT_FOUND");
    const update = body.state === undefined ? body : { ...body, state: normalizeProjectState(body.country ?? oldValue.country, body.state) };
    const { data, error } = await admin.from("projects").update(update).eq("id", id).select().single();
    if (error || !data) throw new ApiError(409, "PROJECT_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "PROJECT_UPDATED", entityType: "PROJECT", entityId: id, oldValue, newValue: data, reason: `${actorTitle(adminProfile.role)} updated project` });
    return NextResponse.json({ project: data });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
