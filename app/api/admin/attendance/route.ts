import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireAuth } from "@/lib/auth-context";
import { fetchAttendanceSessions } from "@/lib/admin-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { demo } = await requireAuth("ADMIN");
    if (demo) return NextResponse.json({ sessions: [], users: [], projects: [], demo: true });
    const params = request.nextUrl.searchParams;
    const admin = createSupabaseAdminClient();
    const [sessions, users, projects] = await Promise.all([
      fetchAttendanceSessions({
        projectId: params.get("project"), workerId: params.get("worker"), customer: params.get("customer"),
        company: params.get("company"), start: params.get("start"), end: params.get("end"), status: params.get("status"),
      }),
      admin.from("profiles").select("id,display_name,username,company").eq("role", "WORKER").order("display_name"),
      admin.from("projects").select("id,project_name,project_code,customer_name").order("project_name"),
    ]);
    if (users.error) throw users.error;
    if (projects.error) throw projects.error;
    return NextResponse.json({ sessions, users: users.data || [], projects: projects.data || [] });
  } catch (error) { return apiErrorResponse(error); }
}
