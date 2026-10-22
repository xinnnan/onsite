import { NextResponse } from "next/server";
import { normalizeCompany } from "@/lib/access-scope";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { fetchCompanyNames, fetchCompanyProjectIds, fetchNextProjectCode, keepScopedAssignments } from "@/lib/admin-data";
import { requireScopedAccess } from "@/lib/auth-context";
import { actorTitle, writeAuditLog } from "@/lib/audit";
import { nextProjectCode } from "@/lib/project-codes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeProjectState } from "@/lib/us-states";
import { parseBody, projectSchema } from "@/lib/validation";

export async function GET() {
  try {
    const { demo, scope } = await requireScopedAccess();
    if (demo) return NextResponse.json({ projects: [], companies: [], next_code: nextProjectCode([]), demo: true });
    const admin = createSupabaseAdminClient();
    let query = admin.from("projects").select("*, project_assignments(id,status,user:profiles(id,display_name,company,role,status))");
    // Managers manage the projects their company owns or their people are assigned to.
    if (scope.kind === "COMPANY") {
      const projectIds = await fetchCompanyProjectIds(scope.company);
      if (!projectIds.length) return NextResponse.json({ projects: [], companies: [], next_code: await fetchNextProjectCode() });
      query = query.in("id", projectIds);
    }
    const [{ data, error }, companies, next_code] = await Promise.all([query.order("project_name"), scope.kind === "ALL" ? fetchCompanyNames() : Promise.resolve([]), fetchNextProjectCode()]);
    if (error) throw error;
    const projects = await Promise.all((data || []).map(async (row) => {
      const project = keepScopedAssignments(scope, row);
      if (!project.map_image_path) return { ...project, map_url: null };
      const signed = await admin.storage.from("project-assets").createSignedUrl(project.map_image_path, 600);
      return { ...project, map_url: signed.data?.signedUrl || null };
    }));
    return NextResponse.json({ projects, companies, next_code });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo, scope } = await requireScopedAccess();
    const parsed = parseBody(projectSchema, await request.json());
    // A manager's project always belongs to their own company, whatever the request says.
    const body = { ...parsed, state: normalizeProjectState(parsed.country, parsed.state), company: scope.kind === "COMPANY" ? scope.company : normalizeCompany(parsed.company) };
    if (demo) return NextResponse.json({ project: { id: crypto.randomUUID(), project_code: nextProjectCode([]), ...body }, demo: true }, { status: 201 });
    const admin = createSupabaseAdminClient();
    // New projects take the next code in sequence. Two created at the same moment can race for one
    // code; the unique index rejects the second, which then takes the code after it.
    let attempt = 0;
    let result;
    do {
      attempt += 1;
      result = await admin.from("projects").insert({ ...body, project_code: await fetchNextProjectCode() }).select().single();
    } while (attempt < 10 && result.error?.code === "23505" && result.error.message.includes("project_code"));
    const { data, error } = result;
    if (error || !data) throw new ApiError(409, "PROJECT_CREATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: "PROJECT_CREATED", entityType: "PROJECT", entityId: data.id, newValue: data, reason: `${actorTitle(adminProfile.role)} created project` });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "VALIDATION_ERROR") return apiErrorResponse(new ApiError(400, "VALIDATION_ERROR", error.message));
    return apiErrorResponse(error);
  }
}
