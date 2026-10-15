import { NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/access-scope";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { fetchCompanyNames, keepScopedAssignments } from "@/lib/admin-data";
import { requireScopedAccess } from "@/lib/auth-context";
import { actorTitle, writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseBody, projectSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { demo, scope } = await requireScopedAccess();
    if (demo) return NextResponse.json({ projects: [], companies: [], demo: true });
    const admin = createSupabaseAdminClient();
    let query = admin.from("projects").select("*, project_assignments(id,status,user:profiles(id,display_name,company,role,status))");
    // Managers manage only the projects their company owns.
    if (scope.kind === "COMPANY") query = query.eq("company", scope.company);
    const [{ data, error }, companies] = await Promise.all([query.order("project_name"), scope.kind === "ALL" ? fetchCompanyNames() : Promise.resolve([])]);
    if (error) throw error;
    const projects = await Promise.all((data || []).map(async (row) => {
      const project = keepScopedAssignments(scope, row);
      if (!project.map_image_path) return { ...project, map_url: null };
      const signed = await admin.storage.from("project-assets").createSignedUrl(project.map_image_path, 600);
      return { ...project, map_url: signed.data?.signedUrl || null };
    }));
    return NextResponse.json({ projects, companies });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo, scope } = await requireScopedAccess();
    const parsed = parseBody(projectSchema, await request.json());
    // A manager's project always belongs to their own company, whatever the request says.
    const body = { ...parsed, company: scope.kind === "COMPANY" ? scope.company : normalizeCompany(parsed.company) };
    if (demo) return NextResponse.json({ project: { id: crypto.randomUUID(), ...body }, demo: true }, { status: 201 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("projects").insert(body).select().single();
    if (error || !data) throw new ApiError(409, "PROJECT_CREATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "PROJECT_CREATED", entityType: "PROJECT", entityId: data.id, newValue: data, reason: `${actorTitle(adminProfile.role)} created project` });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
