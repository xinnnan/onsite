import { NextResponse } from "next/server";
import { ApiError, apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { writeAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { demo } = await requireAuth("ADMIN");
    if (demo) return NextResponse.json({ assignments: [], users: [], projects: [], demo: true });
    const admin = createSupabaseAdminClient();
    const [assignments, users, projects] = await Promise.all([
      admin.from("project_assignments").select("*,user:profiles(id,username,display_name,company,status),project:projects(id,project_code,project_name,status)").order("assigned_at", { ascending: false }),
      admin.from("profiles").select("id,username,display_name,company,worker_type,status").eq("role", "WORKER").order("display_name"),
      admin.from("projects").select("id,project_code,project_name,status").order("project_name"),
    ]);
    if (assignments.error) throw assignments.error;
    if (users.error) throw users.error;
    if (projects.error) throw projects.error;
    return NextResponse.json({ assignments: assignments.data || [], users: users.data || [], projects: projects.data || [] });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { profile: adminProfile, demo } = await requireAuth("ADMIN");
    const body = await request.json() as { user_id?: string; project_id?: string; assigned?: boolean };
    if (!body.user_id || !body.project_id || typeof body.assigned !== "boolean") throw new ApiError(400, "INVALID_ASSIGNMENT_PAYLOAD");
    if (demo) return NextResponse.json({ ok: true, demo: true });
    const admin = createSupabaseAdminClient();
    const { data: oldValue } = await admin.from("project_assignments").select("*").eq("user_id", body.user_id).eq("project_id", body.project_id).maybeSingle();
    const next = body.assigned ? { status: "ACTIVE", assigned_at: new Date().toISOString(), removed_at: null } : { status: "REMOVED", removed_at: new Date().toISOString() };
    const { data, error } = await admin.from("project_assignments").upsert({ user_id: body.user_id, project_id: body.project_id, ...next }, { onConflict: "user_id,project_id" }).select().single();
    if (error || !data) throw new ApiError(409, "ASSIGNMENT_UPDATE_FAILED", error?.message);
    await writeAuditLog({ adminUserId: adminProfile.id, action: body.assigned ? "PROJECT_ASSIGNMENT_ADDED" : "PROJECT_ASSIGNMENT_REMOVED", entityType: "PROJECT_ASSIGNMENT", entityId: data.id, oldValue, newValue: data, reason: "Administrator updated project assignment" });
    return NextResponse.json({ assignment: data });
  } catch (error) { return apiErrorResponse(error); }
}
