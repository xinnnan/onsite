import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { assertAssignmentTargets, fetchVisibleProjects, fetchVisibleWorkers } from "@/lib/admin-data";
import { requireScopedAccess } from "@/lib/auth-context";
import { actorTitle, writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AssignmentPayload = {
  user_id?: string;
  project_id?: string;
  user_ids?: string[];
  project_ids?: string[];
  assigned?: boolean;
};

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export async function GET(request: Request) {
  try {
    const { demo, scope } = await requireScopedAccess();
    if (demo) return NextResponse.json({ assignments: [], users: [], projects: [], demo: true });
    const activeOnly = new URL(request.url).searchParams.get("active_only") === "true";
    const admin = createSupabaseAdminClient();
    const [assignments, users, projects] = await Promise.all([
      admin.from("project_assignments").select("*,user:profiles(id,username,display_name,company,status),project:projects(id,project_code,project_name,status)").order("assigned_at", { ascending: false }),
      fetchVisibleWorkers(scope, "id,username,display_name,company,worker_type,role,status", { activeOnly }),
      fetchVisibleProjects(scope, "id,project_code,project_name,customer_name,site_name,timezone,status,company", { activeOnly }),
    ]);
    if (assignments.error) throw assignments.error;
    const visibleUserIds = new Set(users.map((user) => user.id));
    const visibleProjectIds = new Set(projects.map((project) => project.id));
    // Managers only ever see their own company's people's assignments.
    const visibleAssignments = activeOnly || scope.kind === "COMPANY"
      ? (assignments.data || []).filter((assignment) => visibleUserIds.has(assignment.user_id) && visibleProjectIds.has(assignment.project_id))
      : assignments.data || [];
    return NextResponse.json({ assignments: visibleAssignments, users, projects });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo, scope } = await requireScopedAccess();
    const body = await request.json() as AssignmentPayload;
    const isBatch = Array.isArray(body.user_ids) || Array.isArray(body.project_ids);
    if (isBatch) {
      const userIds = uniqueIds(body.user_ids);
      const projectIds = uniqueIds(body.project_ids);
      const pairCount = userIds.length * projectIds.length;
      if (!userIds.length || !projectIds.length || typeof body.assigned !== "boolean" || userIds.length > 250 || projectIds.length > 100 || pairCount > 5000) {
        throw new ApiError(400, "INVALID_BATCH_ASSIGNMENT_PAYLOAD");
      }
      if (demo) return NextResponse.json({ ok: true, updated: pairCount, demo: true });
      await assertAssignmentTargets(scope, { userIds, projectIds, assigned: body.assigned, errorCode: "INVALID_BATCH_ASSIGNMENT_TARGET" });
      const admin = createSupabaseAdminClient();
      const timestamp = new Date().toISOString();
      let updated = 0;
      if (body.assigned) {
        const rows = userIds.flatMap((userId) => projectIds.map((projectId) => ({
          user_id: userId,
          project_id: projectId,
          status: "ACTIVE",
          assigned_at: timestamp,
          removed_at: null,
        })));
        const { data, error } = await admin.from("project_assignments").upsert(rows, { onConflict: "user_id,project_id" }).select("id");
        if (error) throw new ApiError(409, "BATCH_ASSIGNMENT_UPDATE_FAILED", error.message);
        updated = data?.length || 0;
      } else {
        const { data, error } = await admin.from("project_assignments").update({ status: "REMOVED", removed_at: timestamp }).in("user_id", userIds).in("project_id", projectIds).select("id");
        if (error) throw new ApiError(409, "BATCH_ASSIGNMENT_UPDATE_FAILED", error.message);
        updated = data?.length || 0;
      }
      await writeAuditLog({
        adminUserId: adminProfile.id,
        action: body.assigned ? "PROJECT_ASSIGNMENTS_BULK_ADDED" : "PROJECT_ASSIGNMENTS_BULK_REMOVED",
        entityType: "PROJECT_ASSIGNMENT_BATCH",
        entityId: adminProfile.id,
        newValue: { user_ids: userIds, project_ids: projectIds, requested_pairs: pairCount, updated },
        reason: `${actorTitle(adminProfile.role)} performed a bulk project assignment update`,
      });
      return NextResponse.json({ ok: true, updated, requested_pairs: pairCount });
    }
    if (!body.user_id || !body.project_id || typeof body.assigned !== "boolean") throw new ApiError(400, "INVALID_ASSIGNMENT_PAYLOAD");
    if (demo) return NextResponse.json({ ok: true, demo: true });
    await assertAssignmentTargets(scope, { userIds: [body.user_id], projectIds: [body.project_id], assigned: body.assigned, errorCode: "INVALID_ASSIGNMENT_TARGET" });
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("project_assignments").select("*").eq("user_id", body.user_id).eq("project_id", body.project_id).maybeSingle();
    const next = body.assigned ? { status: "ACTIVE", assigned_at: new Date().toISOString(), removed_at: null } : { status: "REMOVED", removed_at: new Date().toISOString() };
    const { data, error } = await admin.from("project_assignments").upsert({ user_id: body.user_id, project_id: body.project_id, ...next }, { onConflict: "user_id,project_id" }).select().single();
    if (error || !data) throw new ApiError(409, "ASSIGNMENT_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: body.assigned ? "PROJECT_ASSIGNMENT_ADDED" : "PROJECT_ASSIGNMENT_REMOVED", entityType: "PROJECT_ASSIGNMENT", entityId: data.id, oldValue, newValue: data, reason: `${actorTitle(adminProfile.role)} updated project assignment` });
    return NextResponse.json({ assignment: data });
  } catch (error) { return apiErrorResponse(error); }
}
